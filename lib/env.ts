import { z } from "zod";

const boolString = z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().optional(),

    SDU_API_MODE: z.enum(["mock", "live"]).default("mock"),
    SDU_API_BASE_URL: z.url().optional(),
    SDU_CAS_BASE_URL: z.url().optional(),
    SDU_OAUTH_TOKEN_URL: z.url().optional(),
    SDU_CLIENT_ID: z.string().optional(),
    SDU_CLIENT_SECRET: z.string().optional(),
    SDU_API_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
    SDU_CURRENT_TERM: z.string().regex(/^\d{4}-(FALL|SPRING|SUMMER)$/).default("2026-FALL"),

    SDU_MOCK_LATENCY_MS: z.coerce.number().int().nonnegative().default(150),
    SDU_MOCK_SEAT_DRIFT: boolString,

    SESSION_SECRET: z.string().min(32).optional(),
    DATABASE_URL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.SDU_API_MODE === "live") {
      for (const key of [
        "SDU_API_BASE_URL",
        "SDU_CAS_BASE_URL",
        "SDU_OAUTH_TOKEN_URL",
        "SDU_CLIENT_ID",
        "SDU_CLIENT_SECRET",
      ] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required when SDU_API_MODE=live" });
      }
    }
    if (env.NODE_ENV === "production" && !env.SESSION_SECRET) {
      ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "required in production" });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parsed lazily so `next build` doesn't need runtime secrets. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** "2026-FALL" → "Fall 2026" */
export function termLabel(termCode: string): string {
  const [year, season] = termCode.split("-");
  return `${season.charAt(0)}${season.slice(1).toLowerCase()} ${year}`;
}
