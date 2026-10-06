# Database ER Diagram

Entity–relationship diagram of the PostgreSQL schema (`prisma/schema.prisma`), 20 tables.

**Ownership:** the mirror tables (students, transcripts, catalog, sections, enrollments) are refreshed from SDU and keyed by `sdu*Id`; the app owns the planning tables (staged selections, batches, waitlist, reviews, overrides, capacity changes). Live seat counts come from SDU — `enrolledCount`/`totalCapacity` here is the mirrored total.

> `PK` primary key · `FK` foreign key · `UK` unique · `||--o{` one-to-many.

```mermaid
erDiagram
  DEPARTMENT ||--o{ PROGRAM : offers
  DEPARTMENT ||--o{ COURSE : owns
  DEPARTMENT ||--o{ INSTRUCTOR : employs
  DEPARTMENT ||--o{ STAFF_MEMBER : employs
  PROGRAM ||--o{ STUDENT : enrolls
  PROGRAM ||--o{ DEGREE_REQUIREMENT : defines
  COURSE ||--o{ DEGREE_REQUIREMENT : fulfills
  COURSE ||--o{ SECTION : offered_as
  COURSE ||--o{ TRANSCRIPT_ENTRY : recorded_in
  COURSE ||--o{ PREREQUISITE : requires
  COURSE ||--o{ PREREQUISITE : required_by
  COURSE ||--o{ PREREQUISITE_OVERRIDE : waived_in
  TERM ||--o{ SECTION : schedules
  TERM ||--o{ STAGED_SELECTION : for
  TERM ||--o{ REGISTRATION_BATCH : for
  TERM ||--o{ SCHEDULE_REVIEW : for
  TERM ||--o{ PREREQUISITE_OVERRIDE : for
  INSTRUCTOR ||--o{ SECTION : teaches
  SECTION ||--o{ MEETING : meets_at
  SECTION ||--o{ ENROLLMENT : has
  SECTION ||--o{ STAGED_SELECTION : staged_in
  SECTION ||--o{ WAITLIST_ENTRY : has
  SECTION ||--o{ CAPACITY_CHANGE : adjusted_by
  STUDENT ||--o{ TRANSCRIPT_ENTRY : earns
  STUDENT ||--o{ ENROLLMENT : has
  STUDENT ||--o{ STAGED_SELECTION : plans
  STUDENT ||--o{ REGISTRATION_BATCH : submits
  STUDENT ||--o{ WAITLIST_ENTRY : joins
  STUDENT ||--o{ SCHEDULE_REVIEW : requests
  STUDENT ||--o{ PREREQUISITE_OVERRIDE : receives
  STAFF_MEMBER ||--o{ STUDENT : advises
  STAFF_MEMBER ||--o{ SCHEDULE_REVIEW : reviews
  STAFF_MEMBER ||--o{ PREREQUISITE_OVERRIDE : grants
  STAFF_MEMBER ||--o{ CAPACITY_CHANGE : makes
  REGISTRATION_BATCH ||--o{ ENROLLMENT : produces

  TERM {
    string id PK
    string code UK "2026-FALL"
    string name
    boolean isCurrent
  }
  DEPARTMENT {
    string id PK
    string code UK "CSS"
    string name
    string faculty
  }
  PROGRAM {
    string id PK
    string code UK "6B06102"
    string name
    int requiredCredits
    string departmentId FK
  }
  DEGREE_REQUIREMENT {
    string id PK
    string programId FK
    string courseId FK "null = elective bucket"
    enum category
    int creditsRequired
  }
  STUDENT {
    string id PK
    string sduStudentId UK
    string email UK
    string fullName
    string programId FK
    string advisorId FK
    int studyYear
    decimal gpa
    int completedCredits
    enum academicStatus
  }
  STAFF_MEMBER {
    string id PK
    string sduStaffId UK
    string fullName
    enum role "ADVISOR/REGISTRAR/ADMIN"
    string departmentId FK
  }
  INSTRUCTOR {
    string id PK
    string fullName
    string departmentId FK
  }
  COURSE {
    string id PK
    string code UK "CSS 225"
    string title
    int credits "ECTS"
    int level "100-400"
    string departmentId FK
  }
  PREREQUISITE {
    string id PK
    string courseId FK
    string requiredCourseId FK
    int groupNo "OR within, AND across"
    string minGrade
  }
  SECTION {
    string id PK
    string sduSectionId UK
    string courseId FK
    string termId FK
    string instructorId FK
    string sectionNumber "01"
    int totalCapacity
    int enrolledCount "available = total - enrolled"
    int waitlistCount
    enum status
  }
  MEETING {
    string id PK
    string sectionId FK
    enum day
    int startMinute
    int endMinute
    enum kind "LECTURE/PRACTICE/LAB"
    string classroom
  }
  TRANSCRIPT_ENTRY {
    string id PK
    string studentId FK
    string courseId FK
    string termCode
    string letterGrade
    decimal gradePoints
    int credits
    enum status "PASSED/FAILED/WITHDRAWN"
  }
  STAGED_SELECTION {
    string studentId PK "FK"
    string sectionId PK "FK"
    string termId FK
    datetime createdAt
  }
  REGISTRATION_BATCH {
    string id PK
    string studentId FK
    string termId FK
    string idempotencyKey UK
    enum status
    stringarr sectionIds
    json response
  }
  ENROLLMENT {
    string id PK
    string studentId FK
    string sectionId FK
    string batchId FK
    enum status "ENROLLED/DROPPED"
  }
  WAITLIST_ENTRY {
    string id PK
    string studentId FK
    string sectionId FK
    int position
    enum status
    boolean autoEnroll
  }
  SCHEDULE_REVIEW {
    string id PK
    string studentId FK
    string termId FK
    string advisorId FK
    enum status "PENDING/APPROVED"
    json flags
  }
  PREREQUISITE_OVERRIDE {
    string id PK
    string studentId FK
    string courseId FK
    string termId FK
    string grantedById FK
    string reason
    enum status
  }
  CAPACITY_CHANGE {
    string id PK
    string sectionId FK
    string changedById FK
    int previousCapacity
    int newCapacity
    string reason
  }
```

## Reading the model

- **Academic structure** — `TERM`, `DEPARTMENT`, `PROGRAM`, `DEGREE_REQUIREMENT` define what exists and what a degree requires.
- **People** — `STUDENT`, `STAFF_MEMBER` (advisor/registrar/admin), `INSTRUCTOR`.
- **Catalog** — `COURSE`, `PREREQUISITE` (self-referencing CNF: rows sharing `groupNo` are OR, different groups are AND), `SECTION`, `MEETING`.
- **Academic record** — `TRANSCRIPT_ENTRY` (one row per course taken).
- **Registration (app-owned)** — `STAGED_SELECTION` (the planning cart) → `REGISTRATION_BATCH` (one atomic submit) → `ENROLLMENT`; `WAITLIST_ENTRY` for full sections.
- **Advising & admin** — `SCHEDULE_REVIEW` (advisor sign-off), `PREREQUISITE_OVERRIDE` (granted exception), `CAPACITY_CHANGE` (registrar seat adjustment, audited).
