/**
 * Seeds PostgreSQL by running the real sync code against the configured SDU
 * adapter (the mock backend by default), so seed data and production data
 * travel the same path.
 *
 *   npm run db:migrate && npm run db:seed
 */
import "dotenv/config";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { syncCatalog, syncDepartments, syncStudent } from "@/lib/sync/sdu-sync";
import { MOCK_STUDENTS } from "@/services/sdu/fixtures";
import { createSduApi } from "@/services/sduApi";

async function main() {
  const env = getEnv();
  const db = getDb();
  const sdu = createSduApi({ ...env, SDU_MOCK_LATENCY_MS: 0, SDU_MOCK_SEAT_DRIFT: false });

  console.log(`Seeding from SDU (${sdu.mode} mode), term ${env.SDU_CURRENT_TERM}`);
  console.log(`  departments: ${await syncDepartments(db, sdu)}`);

  const catalog = await syncCatalog(db, sdu, env.SDU_CURRENT_TERM);
  console.log(`  courses: ${catalog.courses}, sections: ${catalog.sections}`);

  if (sdu.mode === "mock") {
    for (const student of MOCK_STUDENTS) {
      const result = await syncStudent(db, sdu, student.profile.student_id);
      console.log(`  student ${result.studentId}: ${result.transcriptEntries} transcript entries`);
    }
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
