-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT');

-- CreateEnum
CREATE TYPE "MeetingKind" AS ENUM ('LECTURE', 'PRACTICE', 'LAB');

-- CreateEnum
CREATE TYPE "AcademicStatus" AS ENUM ('ACTIVE', 'PROBATION', 'SUSPENDED', 'GRADUATED');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PASSED', 'FAILED', 'IN_PROGRESS', 'WITHDRAWN', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'DROPPED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'COMMITTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'OFFERED', 'ENROLLED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADVISOR', 'REGISTRAR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "OverrideStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('CORE', 'MAJOR_ELECTIVE', 'GENERAL_EDUCATION', 'FREE_ELECTIVE');

-- CreateTable
CREATE TABLE "terms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredCredits" INTEGER NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degree_requirements" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "courseId" TEXT,
    "category" "RequirementCategory" NOT NULL,
    "recommendedSemester" INTEGER,
    "creditsRequired" INTEGER,
    "note" TEXT,

    CONSTRAINT "degree_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "sduStudentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "studyYear" INTEGER NOT NULL,
    "academicStatus" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "gpa" DECIMAL(3,2) NOT NULL,
    "completedCredits" INTEGER NOT NULL DEFAULT 0,
    "advisorId" TEXT,
    "maxCreditsOverride" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "sduStaffId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "departmentId" TEXT,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructors" (
    "id" TEXT NOT NULL,
    "sduInstructorId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "departmentId" TEXT,

    CONSTRAINT "instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "credits" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prerequisites" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "requiredCourseId" TEXT NOT NULL,
    "groupNo" INTEGER NOT NULL DEFAULT 1,
    "minGrade" TEXT,
    "isCorequisite" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "prerequisites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "sduSectionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "sectionNumber" TEXT NOT NULL,
    "instructorId" TEXT,
    "totalCapacity" INTEGER NOT NULL,
    "enrolledCount" INTEGER NOT NULL DEFAULT 0,
    "waitlistCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SectionStatus" NOT NULL DEFAULT 'OPEN',
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "day" "Weekday" NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "kind" "MeetingKind" NOT NULL,
    "classroom" TEXT NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_entries" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "termCode" TEXT NOT NULL,
    "letterGrade" TEXT,
    "gradePoints" DECIMAL(3,2),
    "credits" INTEGER NOT NULL,
    "status" "TranscriptStatus" NOT NULL,

    CONSTRAINT "transcript_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staged_selections" (
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staged_selections_pkey" PRIMARY KEY ("studentId","sectionId")
);

-- CreateTable
CREATE TABLE "registration_batches" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "sectionIds" TEXT[],
    "sduTransactionId" TEXT,
    "response" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "registration_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "batchId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "droppedAt" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoEnroll" BOOLEAN NOT NULL DEFAULT true,
    "offeredAt" TIMESTAMP(3),
    "offerExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_reviews" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "advisorId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "flags" JSONB NOT NULL DEFAULT '[]',
    "studentNote" TEXT,
    "advisorComment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "schedule_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prerequisite_overrides" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "OverrideStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "prerequisite_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_changes" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "previousCapacity" INTEGER NOT NULL,
    "newCapacity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "syncedToSduAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capacity_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terms_code_key" ON "terms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "programs_code_key" ON "programs"("code");

-- CreateIndex
CREATE INDEX "degree_requirements_programId_category_idx" ON "degree_requirements"("programId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "degree_requirements_programId_courseId_key" ON "degree_requirements"("programId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "students_sduStudentId_key" ON "students"("sduStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE INDEX "students_advisorId_idx" ON "students"("advisorId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_sduStaffId_key" ON "staff_members"("sduStaffId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_email_key" ON "staff_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "instructors_sduInstructorId_key" ON "instructors"("sduInstructorId");

-- CreateIndex
CREATE INDEX "instructors_fullName_idx" ON "instructors"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "courses_departmentId_level_idx" ON "courses"("departmentId", "level");

-- CreateIndex
CREATE INDEX "prerequisites_requiredCourseId_idx" ON "prerequisites"("requiredCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "prerequisites_courseId_groupNo_requiredCourseId_key" ON "prerequisites"("courseId", "groupNo", "requiredCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "sections_sduSectionId_key" ON "sections"("sduSectionId");

-- CreateIndex
CREATE INDEX "sections_termId_status_idx" ON "sections"("termId", "status");

-- CreateIndex
CREATE INDEX "sections_instructorId_idx" ON "sections"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "sections_termId_courseId_sectionNumber_key" ON "sections"("termId", "courseId", "sectionNumber");

-- CreateIndex
CREATE INDEX "meetings_sectionId_idx" ON "meetings"("sectionId");

-- CreateIndex
CREATE INDEX "meetings_day_startMinute_idx" ON "meetings"("day", "startMinute");

-- CreateIndex
CREATE INDEX "transcript_entries_studentId_status_idx" ON "transcript_entries"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_entries_studentId_courseId_termCode_key" ON "transcript_entries"("studentId", "courseId", "termCode");

-- CreateIndex
CREATE INDEX "staged_selections_studentId_termId_idx" ON "staged_selections"("studentId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "registration_batches_idempotencyKey_key" ON "registration_batches"("idempotencyKey");

-- CreateIndex
CREATE INDEX "registration_batches_studentId_termId_idx" ON "registration_batches"("studentId", "termId");

-- CreateIndex
CREATE INDEX "enrollments_sectionId_status_idx" ON "enrollments"("sectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_studentId_sectionId_key" ON "enrollments"("studentId", "sectionId");

-- CreateIndex
CREATE INDEX "waitlist_entries_sectionId_status_position_idx" ON "waitlist_entries"("sectionId", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_studentId_sectionId_key" ON "waitlist_entries"("studentId", "sectionId");

-- CreateIndex
CREATE INDEX "schedule_reviews_advisorId_status_idx" ON "schedule_reviews"("advisorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_reviews_studentId_termId_key" ON "schedule_reviews"("studentId", "termId");

-- CreateIndex
CREATE INDEX "prerequisite_overrides_grantedById_idx" ON "prerequisite_overrides"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "prerequisite_overrides_studentId_courseId_termId_key" ON "prerequisite_overrides"("studentId", "courseId", "termId");

-- CreateIndex
CREATE INDEX "capacity_changes_sectionId_createdAt_idx" ON "capacity_changes"("sectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_requirements" ADD CONSTRAINT "degree_requirements_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_requirements" ADD CONSTRAINT "degree_requirements_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisites" ADD CONSTRAINT "prerequisites_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisites" ADD CONSTRAINT "prerequisites_requiredCourseId_fkey" FOREIGN KEY ("requiredCourseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "instructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_entries" ADD CONSTRAINT "transcript_entries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_entries" ADD CONSTRAINT "transcript_entries_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staged_selections" ADD CONSTRAINT "staged_selections_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staged_selections" ADD CONSTRAINT "staged_selections_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staged_selections" ADD CONSTRAINT "staged_selections_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_batches" ADD CONSTRAINT "registration_batches_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_batches" ADD CONSTRAINT "registration_batches_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "registration_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_reviews" ADD CONSTRAINT "schedule_reviews_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_reviews" ADD CONSTRAINT "schedule_reviews_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_reviews" ADD CONSTRAINT "schedule_reviews_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite_overrides" ADD CONSTRAINT "prerequisite_overrides_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite_overrides" ADD CONSTRAINT "prerequisite_overrides_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite_overrides" ADD CONSTRAINT "prerequisite_overrides_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite_overrides" ADD CONSTRAINT "prerequisite_overrides_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_changes" ADD CONSTRAINT "capacity_changes_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_changes" ADD CONSTRAINT "capacity_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
