-- Integrity rules Prisma's schema language can't express.

-- Meetings: valid, non-empty time window within a day.
ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_time_window_check"
  CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");

-- Sections: seat counters never go negative or over capacity.
ALTER TABLE "sections"
  ADD CONSTRAINT "sections_capacity_check"
  CHECK ("totalCapacity" >= 0 AND "enrolledCount" >= 0 AND "enrolledCount" <= "totalCapacity" AND "waitlistCount" >= 0);

-- Prerequisites: a course cannot require itself.
ALTER TABLE "prerequisites"
  ADD CONSTRAINT "prerequisites_not_self_check"
  CHECK ("courseId" <> "requiredCourseId");

-- Capacity changes must record a real change.
ALTER TABLE "capacity_changes"
  ADD CONSTRAINT "capacity_changes_values_check"
  CHECK ("newCapacity" >= 0 AND "newCapacity" <> "previousCapacity");

-- Students: GPA on the 4.0 scale.
ALTER TABLE "students"
  ADD CONSTRAINT "students_gpa_check"
  CHECK ("gpa" >= 0 AND "gpa" <= 4);
