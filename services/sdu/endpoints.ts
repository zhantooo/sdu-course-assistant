/**
 * Single source of truth for SDU endpoint mappings.
 *
 * `target` picks the base URL: "cas" → SDU_CAS_BASE_URL, "api" → SDU_API_BASE_URL.
 * The HTTP transport builds real URLs from these; the mock transport dispatches
 * on the endpoint key, so both modes share one routing table.
 *
 * Paths other than the CAS protocol ones (which are standard) are proposals —
 * confirm them against SDU IT's API catalogue before go-live.
 */
export const SDU_ENDPOINTS = {
  // CAS protocol v3 — https://apereo.github.io/cas/7.0.x/protocol/CAS-Protocol-Specification.html
  casLogin: { method: "GET", target: "cas", path: "/cas/login" },
  casLogout: { method: "GET", target: "cas", path: "/cas/logout" },
  casServiceValidate: { method: "GET", target: "cas", path: "/cas/p3/serviceValidate" },

  // Student sync
  studentProfile: { method: "GET", target: "api", path: "/api/v1/students/:studentId/profile" },
  studentTranscript: { method: "GET", target: "api", path: "/api/v1/students/:studentId/transcript" },

  // Catalog
  departments: { method: "GET", target: "api", path: "/api/v1/departments" },
  termSections: { method: "GET", target: "api", path: "/api/v1/terms/:termCode/sections" },
  sectionAvailability: {
    method: "GET",
    target: "api",
    path: "/api/v1/terms/:termCode/sections/availability",
  },

  // Registration engine
  batchSubmit: { method: "POST", target: "api", path: "/api/v1/registration/batch-submit" },
  waitlistJoin: { method: "POST", target: "api", path: "/api/v1/sections/:sectionId/waitlist" },
} as const satisfies Record<string, EndpointDef>;

export interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  target: "cas" | "api";
  path: string;
}

export type SduEndpointKey = keyof typeof SDU_ENDPOINTS;

/** Fills `:param` placeholders, URL-encoding each value. */
export function buildPath(template: string, params: Record<string, string> = {}): string {
  return template.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path param "${name}" for ${template}`);
    return encodeURIComponent(value);
  });
}
