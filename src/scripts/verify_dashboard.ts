import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { signTenantToken } from "../lib/auth/jwt";

async function verifyStudentDashboard() {
  const baseUrl = "http://localhost:3000";
  const tenant = "acme";

  console.log("=== Verifying Student Dashboard API for admin@acme.com ===");

  const token = await signTenantToken({
    userId: "e6815f68-6231-4a86-aa7a-fccd49058d64",
    name: "Адміністратор Acme",
    email: "admin@acme.com",
    role: "admin",
    tenantSubdomain: "acme",
  });

  const res = await fetch(`${baseUrl}/api/student/dashboard?tenant=${tenant}`, {
    headers: {
      "x-tenant-override": tenant,
      Cookie: `tenanx_auth_token=${token}`,
    },
  });

  const data = await res.json();
  console.log("Dashboard response success:", data.success);

  if (!data.success) {
    throw new Error("Dashboard error: " + data.error);
  }

  const { stats, courses } = data.data;
  console.log("Dashboard Stats:", stats);
  console.log("Courses Count:", courses.length);
  if (courses.length > 0) {
    console.log("Course 1 quizzes:", courses[0].quizzes);
  }

  if (stats.totalQuizzesPassed !== 1) {
    throw new Error(`Expected totalQuizzesPassed 1, got ${stats.totalQuizzesPassed}`);
  }
  if (stats.points !== 50) {
    throw new Error(`Expected points 50, got ${stats.points}`);
  }

  console.log("✅ Student Dashboard verification passed!");
}

verifyStudentDashboard().catch((err) => {
  console.error("Dashboard verify failed:", err);
  process.exit(1);
});
