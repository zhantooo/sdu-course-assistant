# SDU Course Registration Assistant

Plan, validate and (from Sprint 5) submit course registration for Suleyman Demirel University students.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · shadcn-style components · Lucide · Sonner toasts · Prisma 7 + PostgreSQL · Zod · jose (sessions) · Vitest.

**Design:** minimal, monotone, modern — neutral zinc surfaces, hairline borders, soft shadows, one restrained blue accent, generous whitespace. No gradients. Colour carries meaning only (emerald = passed/open, red = conflict/full, amber = limited). Design tokens live in `app/globals.css`.

**Status:** this is the first delivery. It covers the project skeleton, the database schema for all 7 sprints, the SDU integration service (mock and live adapters), and the main planner dashboard. The rule engine for Sprints 2–3 (credit limit, seat status, time conflicts, prerequisites) is already built into the dashboard, because the timetable can't be interactive without it.

---

## Quick start

Requires **Node.js ≥ 20.9**.

```bash
npm install
cp .env.example .env.local      # defaults run fully offline against the mock SDU backend
npm run dev                     # http://localhost:3000 → sign in as a demo student
```

Tests and checks:

```bash
npm test            # 31 unit/integration tests (rules, search, SDU client + mock)
npm run typecheck
npm run build
```

Database (optional for the dashboard in mock mode):

```bash
# set DATABASE_URL in .env.local first
npm run db:migrate  # applies prisma/migrations (schema + CHECK constraints)
npm run db:seed     # syncs departments, catalog, demo students via the SDU adapter
```

Demo accounts (mock SSO): `230107021`, Aigerim Tulegenova, CS year 3 (has a failed course to retake); `240103118`, Nursultan Abenov, IS year 2.

---

## Project structure

```
sdu-course-assistant/
├── app/
│   ├── layout.tsx                    Root layout: fonts (Onest + JetBrains Mono, Kazakh-ready), toaster
│   ├── globals.css                   Tailwind v4 theme tokens: navy / gold / emerald / crimson / cyan
│   ├── (auth)/login/page.tsx         SSO sign-in (mock mode lists demo students)
│   ├── (app)/                        Authenticated shell (header + nav)
│   │   ├── layout.tsx
│   │   ├── error.tsx                 "SDU unreachable" boundary with retry
│   │   ├── dashboard/                ★ Planner: search sidebar + timetable + plan
│   │   └── transcript/               Completed-course tracker
│   └── api/
│       ├── auth/{login,callback,logout}/route.ts   CAS SSO flow → signed session cookie
│       ├── me/route.ts                             Profile + transcript sync
│       ├── courses/route.ts                        Multi-filter catalog search
│       └── sections/availability/route.ts          Live seat counts (polled)
├── components/
│   ├── ui/                           shadcn-style primitives (button, badge, card, input, meter…)
│   ├── layout/                       App header, nav
│   ├── dashboard/                    Workspace state owner, search sidebar, result cards,
│   │                                 plan panel, stat strip, live-seat + plan hooks
│   └── timetable/timetable-grid.tsx  ★ Interactive Mon–Fri grid with lane layout & previews
├── lib/
│   ├── domain/                       App-wide types + time helpers (decoupled from SDU wire format)
│   ├── registration/                 ★ Pure rule engine: conflicts, prerequisites, credit policy
│   ├── catalog/search.ts             Shared search/filter (API route and client use the same code)
│   ├── auth/                         JWT session (token.ts is edge/proxy-safe)
│   ├── sync/sdu-sync.ts              SDU → Postgres mirror (seed today, cron later)
│   ├── data/queries.ts               Request-scoped RSC loaders
│   ├── api/http.ts                   Route wrapper: auth + SDU error mapping
│   ├── env.ts                        Zod-validated environment
│   └── db.ts                         Prisma client (pg driver adapter)
├── services/
│   ├── sduApi.ts                     ★ SDU integration service: client, transports, factory
│   └── sdu/
│       ├── endpoints.ts              Endpoint map (single routing table for both modes)
│       ├── contracts.ts              Zod wire schemas (snake_case, validated at the boundary)
│       ├── mappers.ts                Wire → domain translation
│       ├── mock-server.ts            In-process fake SDU backend (atomic batch submit, seat drift)
│       └── fixtures.ts               Fictional catalog, instructors, students
├── prisma/
│   ├── schema.prisma                 ★ All tables for Sprints 1–7
│   ├── migrations/                   init + integrity CHECK constraints
│   └── seed.ts
├── proxy.ts                          Next 16 "proxy" (formerly middleware): auth gate
└── prisma.config.ts
```

### Planned additions by sprint

| Sprint | Adds |
|---|---|
| 4 | `lib/recommendation/` (scoring against `DegreeRequirement`), `app/api/recommendations/route.ts`, recommendation rail in the sidebar |
| 5 | `app/api/plan/route.ts` (moves the plan from localStorage to `StagedSelection`), `app/api/registration/submit/route.ts` (wraps `sdu.batchSubmit` and records a `RegistrationBatch`), `app/api/waitlist/route.ts`, a submit bar in `PlanPanel` |
| 6 | `components/chat/` floating assistant + `app/api/chat/route.ts` (grounded in catalog and plan data), `app/(advisor)/reviews/…` plus `app/api/advisor/reviews/…` (`ScheduleReview`) |
| 7 | `app/(admin)/capacity/…` + `app/api/admin/sections/[id]/capacity` (`CapacityChange`, pushed to SDU), `app/api/advisor/overrides` (`PrerequisiteOverride`, fed into `evaluatePrerequisites(…, waived)`) |

Roles: the session type currently has only `STUDENT`. Sprints 6 and 7 add `ADVISOR` and `REGISTRAR` claims from CAS attributes. They map to `StaffMember.role` and get their own route groups guarded in `proxy.ts`.

---

## SDU integration

```
UI / routes ──► SduApiClient ──► SduTransport ─┬─► HttpSduTransport   (SDU_API_MODE=live)
                (zod parse +                   │     CAS + REST, OAuth2 client-credentials,
                 wire→domain map)              │     retries w/ backoff, timeouts, Idempotency-Key
                                               └─► MockSduTransport   (SDU_API_MODE=mock, default)
                                                     in-process fake answering the same endpoint keys
```

The mock sits at the *transport* level, so in dev the client's parsing, mapping, pagination and error handling all run exactly as they would in production.

| Key | Method | Path | Notes |
|---|---|---|---|
| `casLogin` | GET | `/cas/login?service=` | Browser redirect |
| `casServiceValidate` | GET | `/cas/p3/serviceValidate?format=JSON` | CAS protocol v3 |
| `casLogout` | GET | `/cas/logout?service=` | Single sign-out |
| `studentProfile` | GET | `/api/v1/students/:studentId/profile` | GPA, program, `completed_credits`, advisor |
| `studentTranscript` | GET | `/api/v1/students/:studentId/transcript` | `transcript_data[]` |
| `departments` | GET | `/api/v1/departments` | |
| `termSections` | GET | `/api/v1/terms/:termCode/sections?cursor=` | Paginated; `available_seats`, `total_capacity`, `instructor_name`, `time_slots`, `classroom` |
| `sectionAvailability` | GET | `/api/v1/terms/:termCode/sections/availability?ids=` | Live seats |
| `batchSubmit` | POST | `/api/v1/registration/batch-submit` | Atomic, all-or-nothing; `Idempotency-Key` header |
| `waitlistJoin` | POST | `/api/v1/sections/:sectionId/waitlist` | |

> ⚠️ **Confirm with SDU IT before going live.** The CAS paths follow the public CAS protocol. The REST paths and payload shapes are a **proposed contract**, not a published SDU spec. When SDU provides its real OpenAPI document, the expected changes are limited to `services/sdu/endpoints.ts`, `contracts.ts` and `mappers.ts`.

### Auth flow

`/api/auth/login` → CAS (`/cas/login?service=…/api/auth/callback`) → `/api/auth/callback?ticket=` → server-to-server `serviceValidate` → profile check (suspended or graduated accounts are refused) → HS256 session cookie (8 h, httpOnly). `proxy.ts` redirects signed-out page views, and API routes return `401`.

---

## Registration rules (`lib/registration/`)

| Rule | Behaviour | Sprint |
|---|---|---|
| Already passed | Block | 1 |
| Section full | Block (waitlist in Sprint 5) | 2 |
| Credit limit | Block over limit; standard 30 ECTS, 35 at GPA ≥ 3.33, 20 on probation | 2 |
| Prerequisites | Block. Rules are AND-of-OR groups, e.g. `CSS 225 and (MAT 201 or MAT 250)`, and support advisor waivers | 3 |
| Time conflict | Warn (sweep-line per day, exclusive end times); highlighted per meeting on the grid | 3 |
| Same course, other section | Treated as a swap, not extra credits | — |

`CREDIT_POLICY` values are **placeholders**. Confirm them with the Registrar; they all live in `lib/registration/credits.ts`. The mock SDU enforces the same rules server-side on batch submit, as the real registration engine should.

---

## Database

The ownership model is documented at the top of `prisma/schema.prisma`. SDU is the system of record: students, transcripts, the catalog and enrolments are mirrored locally, keyed by SDU ids. This app owns the planning state: staged selections, batches, waitlist, reviews, overrides and capacity changes.

| Group | Tables |
|---|---|
| Structure | `terms`, `departments`, `programs`, `degree_requirements` |
| People | `students`, `staff_members` (advisor / registrar / admin), `instructors` |
| Catalog | `courses`, `prerequisites` (CNF: `groupNo`), `sections`, `meetings` |
| Record | `transcript_entries` |
| Registration | `staged_selections`, `registration_batches` (idempotency key), `enrollments`, `waitlist_entries` |
| Advising / admin | `schedule_reviews`, `prerequisite_overrides`, `capacity_changes` |

Available seats are derived (`totalCapacity − enrolledCount`), never stored. The second migration adds CHECK constraints for time windows, seat counters, self-prerequisites and GPA range.

---

## Design notes

- **Minimal & monotone:** neutral zinc surfaces on a near-white app background, 1 px hairline borders, soft shadows, one restrained blue accent for interactive/selected state. No gradients, no heavy chrome.
- **Colour carries meaning only, sparingly:** emerald = open or passed, red = full or conflict, amber = limited seats, blue = in plan or preview. Timetable block tints are low-saturation and avoid strong emerald/red so status stays unambiguous.
- **Typography:** Onest (Cyrillic-ready) for UI, JetBrains Mono with tabular figures for codes, credits and times.
- Hovering a section previews it on the grid as a dashed ghost block. Overlapping blocks sit side by side in lanes. Removing a section shows an Undo toast. Seats poll every 10 s (paused in background tabs) and toast when a staged section fills or reopens.
- Blocked "Add" buttons stay focusable, using `aria-disabled`, so keyboard and screen-reader users hear *why* a section is locked.
- Mobile: panels stack and the timetable scrolls horizontally inside its own card.
