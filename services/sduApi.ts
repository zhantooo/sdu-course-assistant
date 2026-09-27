/**
 * SDU integration service — the only module the rest of the app uses to talk
 * to Suleyman Demirel University's internal systems.
 *
 *   SduApiClient ──► SduTransport ──┬─► HttpSduTransport  (live: CAS + REST, OAuth2 client credentials)
 *   (parse + map)                   └─► MockSduTransport  (dev: in-process fake of the same endpoints)
 *
 * Both transports are driven by the endpoint table in ./sdu/endpoints.ts and
 * every response is validated against ./sdu/contracts.ts before being mapped
 * to domain types, so switching SDU_API_MODE=mock → live changes nothing above
 * this file.
 */
import { z } from "zod";
import { getEnv, type Env } from "@/lib/env";
import type {
  BatchSubmitResult,
  Course,
  Department,
  SeatAvailability,
  StudentProfile,
  Transcript,
  WaitlistJoinResult,
} from "@/lib/domain/types";
import * as contracts from "./sdu/contracts";
import { buildPath, SDU_ENDPOINTS, type SduEndpointKey } from "./sdu/endpoints";
import * as map from "./sdu/mappers";
import { handleMockRequest } from "./sdu/mock-server";

// ─── Errors ────────────────────────────────────────────────────────────────

export class SduApiError extends Error {
  readonly isSduApiError = true;
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly endpoint: SduEndpointKey | "oauthToken",
  ) {
    super(message);
    this.name = "SduApiError";
  }
}

/**
 * Robust guard. `instanceof` can fail across duplicated module instances
 * (Turbopack HMR, separate server bundles), which previously let SDU errors
 * escape route `catch` blocks and surface as a 500. Check a brand instead.
 */
export function isSduApiError(error: unknown): error is SduApiError {
  if (error instanceof SduApiError) return true;
  if (typeof error !== "object" || error === null) return false;
  const e = error as { isSduApiError?: boolean; name?: string };
  return e.isSduApiError === true || e.name === "SduApiError";
}

// ─── Transport abstraction ─────────────────────────────────────────────────

export interface SduRequest {
  endpoint: SduEndpointKey;
  params?: Record<string, string>;
  query?: Record<string, string | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Safe to retry. Defaults to true for GET; set for POSTs guarded by an Idempotency-Key. */
  retryable?: boolean;
}

export interface SduResponse {
  status: number;
  body: unknown;
}

export interface SduTransport {
  readonly mode: "mock" | "live";
  send(request: SduRequest): Promise<SduResponse>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function definedEntries(record: Record<string, string | undefined> = {}): [string, string][] {
  return Object.entries(record).filter((e): e is [string, string] => e[1] !== undefined);
}

export class MockSduTransport implements SduTransport {
  readonly mode = "mock" as const;

  constructor(private readonly options: { latencyMs: number; seatDrift: boolean }) {}

  async send(request: SduRequest): Promise<SduResponse> {
    if (this.options.latencyMs > 0) {
      await sleep(this.options.latencyMs * (0.5 + Math.random()));
    }
    const response = handleMockRequest(
      request.endpoint,
      {
        params: request.params ?? {},
        query: Object.fromEntries(definedEntries(request.query)),
        body: request.body ?? null,
        headers: Object.fromEntries(
          Object.entries(request.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
        ),
      },
      { seatDrift: this.options.seatDrift },
    );
    // Serialise like a real network hop so callers never share references with mock state.
    return { status: response.status, body: JSON.parse(JSON.stringify(response.body)) };
  }
}

const oauthTokenResponse = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().int().positive(),
});

export interface HttpTransportConfig {
  apiBaseUrl: string;
  casBaseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
  maxRetries?: number;
}

export class HttpSduTransport implements SduTransport {
  readonly mode = "live" as const;
  private token: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(private readonly config: HttpTransportConfig) {}

  buildUrl(request: Pick<SduRequest, "endpoint" | "params" | "query">): URL {
    const def = SDU_ENDPOINTS[request.endpoint];
    const base = def.target === "cas" ? this.config.casBaseUrl : this.config.apiBaseUrl;
    const url = new URL(buildPath(def.path, request.params), base);
    for (const [key, value] of definedEntries(request.query)) url.searchParams.set(key, value);
    return url;
  }

  async send(request: SduRequest): Promise<SduResponse> {
    const def = SDU_ENDPOINTS[request.endpoint];
    const retryable = request.retryable ?? def.method === "GET";
    const attempts = retryable ? (this.config.maxRetries ?? 2) + 1 : 1;

    for (let attempt = 0; ; attempt++) {
      const isLast = attempt >= attempts - 1;
      let response: Response;
      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
          "X-Request-Id": crypto.randomUUID(),
          ...request.headers,
        };
        if (def.target === "api") headers.Authorization = `Bearer ${await this.accessToken()}`;
        if (request.body !== undefined) headers["Content-Type"] = "application/json";

        response = await fetch(this.buildUrl(request), {
          method: def.method,
          headers,
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: AbortSignal.timeout(this.config.timeoutMs),
          cache: "no-store",
        });
      } catch (error) {
        if (error instanceof SduApiError) throw error;
        if (!isLast) {
          await this.backoff(attempt);
          continue;
        }
        const reason = error instanceof Error ? error.message : String(error);
        throw new SduApiError(`SDU ${request.endpoint} unreachable: ${reason}`, 503, "SDU_UNREACHABLE", request.endpoint);
      }

      if (response.status === 401 && def.target === "api") this.token = null;
      const transient = response.status === 401 || response.status === 429 || response.status >= 500;
      if (transient && !isLast) {
        await this.backoff(attempt, response.headers.get("retry-after"));
        continue;
      }

      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { error: { code: "NON_JSON_RESPONSE", message: text.slice(0, 200) } };
        }
      }
      return { status: response.status, body };
    }
  }

  private async backoff(attempt: number, retryAfter?: string | null) {
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    const ms = Number.isFinite(seconds) ? seconds * 1000 : 250 * 2 ** attempt + Math.random() * 100;
    await sleep(Math.min(ms, 5000));
  }

  /** OAuth2 client-credentials token for service-to-service calls, cached until shortly before expiry. */
  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;
    this.tokenRequest ??= this.fetchToken().finally(() => {
      this.tokenRequest = null;
    });
    return this.tokenRequest;
  }

  private async fetchToken(): Promise<string> {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new SduApiError(`OAuth token request failed (${response.status})`, 502, "OAUTH_FAILED", "oauthToken");
    }
    const token = oauthTokenResponse.parse(await response.json());
    this.token = { value: token.access_token, expiresAt: Date.now() + (token.expires_in - 60) * 1000 };
    return token.access_token;
  }
}

// ─── Client ────────────────────────────────────────────────────────────────

export class SduApiClient {
  constructor(
    private readonly transport: SduTransport,
    private readonly config: { casBaseUrl?: string } = {},
  ) {}

  get mode(): "mock" | "live" {
    return this.transport.mode;
  }

  private async call<S extends z.ZodType>(request: SduRequest, schema: S): Promise<z.output<S>> {
    const response = await this.transport.send(request);
    if (response.status < 200 || response.status >= 300) {
      const error = contracts.sduErrorBody.safeParse(response.body);
      throw new SduApiError(
        error.success ? error.data.error.message : `HTTP ${response.status}`,
        response.status,
        error.success ? error.data.error.code : "HTTP_ERROR",
        request.endpoint,
      );
    }
    const parsed = schema.safeParse(response.body);
    if (!parsed.success) {
      throw new SduApiError(
        `SDU ${request.endpoint} response did not match contract:\n${z.prettifyError(parsed.error)}`,
        502,
        "CONTRACT_VIOLATION",
        request.endpoint,
      );
    }
    return parsed.data;
  }

  // ── SSO (CAS) ──

  /**
   * Where to send the browser to sign in. In mock mode there is no CAS server,
   * so we hand straight back to our callback with a synthetic service ticket.
   */
  buildLoginUrl(serviceUrl: string, options: { mockStudentId?: string } = {}): string {
    if (this.mode === "mock") {
      const url = new URL(serviceUrl);
      url.searchParams.set("ticket", `ST-MOCK-${options.mockStudentId ?? ""}`);
      return url.toString();
    }
    const url = new URL(SDU_ENDPOINTS.casLogin.path, this.requireCasBase());
    url.searchParams.set("service", serviceUrl);
    return url.toString();
  }

  /** CAS single sign-out URL, or null in mock mode. */
  buildLogoutUrl(returnUrl: string): string | null {
    if (this.mode === "mock") return null;
    const url = new URL(SDU_ENDPOINTS.casLogout.path, this.requireCasBase());
    url.searchParams.set("service", returnUrl);
    return url.toString();
  }

  async validateServiceTicket(ticket: string, serviceUrl: string): Promise<{ studentId: string }> {
    const body = await this.call(
      { endpoint: "casServiceValidate", query: { ticket, service: serviceUrl, format: "JSON" } },
      contracts.casServiceValidateResponse,
    );
    const result = body.serviceResponse;
    if ("authenticationFailure" in result) {
      const { code, description } = result.authenticationFailure;
      throw new SduApiError(description, 401, code, "casServiceValidate");
    }
    return { studentId: result.authenticationSuccess.user };
  }

  private requireCasBase(): string {
    if (!this.config.casBaseUrl) throw new Error("SDU_CAS_BASE_URL is not configured");
    return this.config.casBaseUrl;
  }

  // ── Student sync ──

  async getStudentProfile(studentId: string): Promise<StudentProfile> {
    const dto = await this.call({ endpoint: "studentProfile", params: { studentId } }, contracts.sduStudentProfile);
    return map.toStudentProfile(dto);
  }

  async getTranscript(studentId: string): Promise<Transcript> {
    const dto = await this.call({ endpoint: "studentTranscript", params: { studentId } }, contracts.sduTranscript);
    return map.toTranscript(dto);
  }

  // ── Catalog ──

  async getDepartments(): Promise<Department[]> {
    const dto = await this.call({ endpoint: "departments" }, contracts.sduDepartmentList);
    return dto.departments.map(map.toDepartment);
  }

  /** Full published schedule for a term, following SDU's cursor pagination. */
  async getCatalog(termCode: string): Promise<Course[]> {
    const sections: contracts.SduSection[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const dto = await this.call(
        { endpoint: "termSections", params: { termCode }, query: { cursor, limit: "100" } },
        contracts.sduSectionPage,
      );
      sections.push(...dto.sections);
      if (!dto.next_cursor) return map.toCourses(sections);
      cursor = dto.next_cursor;
    }
    throw new SduApiError("Catalog pagination did not terminate", 502, "PAGINATION_RUNAWAY", "termSections");
  }

  /** Live seat counts. Omit `sectionIds` for every section in the term. */
  async getSeatAvailability(termCode: string, sectionIds?: string[]): Promise<SeatAvailability[]> {
    const dto = await this.call(
      { endpoint: "sectionAvailability", params: { termCode }, query: { ids: sectionIds?.join(",") } },
      contracts.sduAvailability,
    );
    return map.toSeatAvailability(dto);
  }

  // ── Registration engine ──

  /**
   * Atomic batch registration: SDU either enrols every section or none.
   * The idempotency key makes retries (and double-clicks) safe.
   */
  async batchSubmit(input: {
    studentId: string;
    termCode: string;
    sectionIds: string[];
    idempotencyKey: string;
  }): Promise<BatchSubmitResult> {
    const body: contracts.SduBatchSubmitRequest = contracts.sduBatchSubmitRequest.parse({
      student_id: input.studentId,
      term_code: input.termCode,
      section_ids: input.sectionIds,
    });
    const dto = await this.call(
      {
        endpoint: "batchSubmit",
        body,
        headers: { "Idempotency-Key": input.idempotencyKey },
        retryable: true,
      },
      contracts.sduBatchSubmitResponse,
    );
    return map.toBatchSubmitResult(dto);
  }

  async joinWaitlist(input: { studentId: string; sectionId: string }): Promise<WaitlistJoinResult> {
    const dto = await this.call(
      {
        endpoint: "waitlistJoin",
        params: { sectionId: input.sectionId },
        body: { student_id: input.studentId },
      },
      contracts.sduWaitlistJoinResponse,
    );
    return { sectionId: dto.section_id, position: dto.position, status: dto.status };
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

export function createSduApi(env: Env = getEnv()): SduApiClient {
  if (env.SDU_API_MODE === "live") {
    // getEnv() has already verified these are present in live mode.
    const transport = new HttpSduTransport({
      apiBaseUrl: env.SDU_API_BASE_URL!,
      casBaseUrl: env.SDU_CAS_BASE_URL!,
      tokenUrl: env.SDU_OAUTH_TOKEN_URL!,
      clientId: env.SDU_CLIENT_ID!,
      clientSecret: env.SDU_CLIENT_SECRET!,
      timeoutMs: env.SDU_API_TIMEOUT_MS,
    });
    return new SduApiClient(transport, { casBaseUrl: env.SDU_CAS_BASE_URL });
  }
  return new SduApiClient(
    new MockSduTransport({ latencyMs: env.SDU_MOCK_LATENCY_MS, seatDrift: env.SDU_MOCK_SEAT_DRIFT }),
  );
}

const globalForSdu = globalThis as unknown as { __sduApi?: SduApiClient };

/** Process-wide client (keeps the OAuth token cache warm across requests). */
export function getSduApi(): SduApiClient {
  globalForSdu.__sduApi ??= createSduApi();
  return globalForSdu.__sduApi;
}
