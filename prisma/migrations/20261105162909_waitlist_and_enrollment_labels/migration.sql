-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "course" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "studentNo" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "waitlist_entries" ADD COLUMN     "course" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "studentNo" TEXT NOT NULL DEFAULT '';
