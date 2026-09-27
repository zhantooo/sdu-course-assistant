/**
 * Low-level HTTP client for SDU's Student Information System (my.sdu.edu.kz).
 *
 * The SIS is a classic PHP app: a session cookie (PHPSESSID), server-rendered
 * HTML, and a few `?ajx=1` fragment endpoints. There is no JSON API, so this
 * client keeps a cookie jar, drives the login → 2-factor → session flow, and
 * fetches module pages that the parsers (./parse.ts) turn into domain data.
 *
 * SAFETY: only ever performs reads (login + GET pages). It never calls the
 * registration write endpoints (AddCourse / StudConfirm / removeCR …).
 */
import { parse as parseHtml, type HTMLElement } from "node-html-parser";

const DEFAULT_BASE = "https://my.sdu.edu.kz";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Minimal cookie jar for one origin. */
export class CookieJar {
  private jar = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.jar.set(k, v);
  }

  absorb(response: Response): void {
    // Node 18+/undici exposes getSetCookie(); fall back to a single header.
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const raw =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : ([response.headers.get("set-cookie")].filter(Boolean) as string[]);
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) this.jar.set(name, value);
    }
  }

  header(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  toJSON(): Record<string, string> {
    return Object.fromEntries(this.jar);
  }

  get hasSession(): boolean {
    return [...this.jar.keys()].some((k) => /^PHPSESSID$/i.test(k));
  }
}

export interface SisRequestResult {
  status: number;
  url: string;
  location: string | null;
  html: string;
  doc: HTMLElement;
}

export class SisHttp {
  readonly baseUrl: string;
  readonly jar: CookieJar;

  constructor(options: { baseUrl?: string; cookies?: Record<string, string> } = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
    this.jar = new CookieJar(options.cookies);
  }

  private async request(
    path: string,
    init: { method?: "GET" | "POST"; body?: string; referer?: string } = {},
  ): Promise<SisRequestResult> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en,kk;q=0.9,ru;q=0.8",
    };
    if (this.jar.header()) headers.Cookie = this.jar.header();
    if (init.referer) headers.Referer = init.referer;
    if (init.method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";

    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    this.jar.absorb(response);

    const html = response.status >= 300 && response.status < 400 ? "" : await response.text();
    return {
      status: response.status,
      url,
      location: response.headers.get("location"),
      html,
      doc: parseHtml(html || ""),
    };
  }

  /** GET, transparently following same-origin redirects (keeping cookies). */
  async get(path: string, referer?: string): Promise<SisRequestResult> {
    let result = await this.request(path, { referer });
    for (let hop = 0; hop < 5 && result.location; hop++) {
      result = await this.request(result.location, { referer: this.baseUrl });
    }
    return result;
  }

  /** POST a urlencoded form; returns the immediate response (redirects inspected by caller via get). */
  async postForm(path: string, fields: Record<string, string>, referer?: string): Promise<SisRequestResult> {
    const body = new URLSearchParams(fields).toString();
    return this.request(path, { method: "POST", body, referer });
  }

  form(fields: Record<string, string>): string {
    return new URLSearchParams(fields).toString();
  }
}

/** Extracts a form's action + all input/select field defaults from a parsed page. */
export function readForm(
  doc: HTMLElement,
  predicate?: (form: HTMLElement) => boolean,
): { action: string; fields: Record<string, string>; passwordField?: string; textField?: string } | null {
  const forms = doc.querySelectorAll("form");
  const form = predicate ? forms.find(predicate) : forms[0];
  if (!form) return null;
  const fields: Record<string, string> = {};
  let passwordField: string | undefined;
  let textField: string | undefined;
  for (const el of form.querySelectorAll("input, select")) {
    const name = el.getAttribute("name");
    if (!name) continue;
    const type = (el.getAttribute("type") ?? "text").toLowerCase();
    if (type === "submit" || type === "button") continue;
    fields[name] = el.getAttribute("value") ?? "";
    if (type === "password") passwordField = name;
    else if (type === "text" || type === "tel" || type === "number") textField ??= name;
  }
  return { action: form.getAttribute("action") ?? "", fields, passwordField, textField };
}
