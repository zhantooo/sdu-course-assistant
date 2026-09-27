export const SIS_PENDING_COOKIE = "sdu_login";

export const pendingCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 10 * 60, // 10 minutes to complete 2FA
};

export function sisBaseUrl(): string {
  return process.env.SDU_SIS_BASE_URL ?? "https://my.sdu.edu.kz";
}
