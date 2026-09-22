import { signTenantToken } from "../lib/auth/jwt";
import { withTenantDb } from "../db/connection-manager";
import { users } from "../db/schema/tenant";
import { eq } from "drizzle-orm";

const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=== ПОЧАТОК ТЕСТУВАННЯ ДАШБОРДІВ ТА АНАЛІТИКИ ===");

  // 1. Тест 1: Перевірка оновлення last_login_at при вході
  console.log("\n1. Тестування оновлення last_login_at при авторизації...");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "student@acme.com",
      password: "password123",
      subdomain: "acme",
    }),
  });

  const loginData = await loginRes.json();
  console.log("   Статус логіну:", loginRes.status, loginData.message);
  if (!loginData.success) {
    throw new Error("Не вдалося увійти як student@acme.com: " + loginData.error);
  }

  // Перевірка в базі даних Neon (схема acme)
  const studentUser = await withTenantDb("acme", async (db) => {
    const [u] = await db.select().from(users).where(eq(users.email, "student@acme.com"));
    return u;
  });

  console.log("   ✓ Зафіксовано в базі даних lastLoginAt:", studentUser.lastLoginAt);
  if (!studentUser.lastLoginAt) {
    throw new Error("Помилка: last_login_at не оновився після входу!");
  }

  // 2. Тест 2: Студентський дашборд (GET /api/student/dashboard)
  console.log("\n2. Тестування API студентського дашборду (GET /api/student/dashboard)...");
  const studentToken = await signTenantToken({
    userId: studentUser.id,
    name: studentUser.name,
    email: studentUser.email,
    role: studentUser.role,
    tenantSubdomain: "acme",
  });

  const studentDashRes = await fetch(`${BASE_URL}/api/student/dashboard?tenant=acme`, {
    headers: {
      "x-tenant-override": "acme",
      Cookie: `tenanx_auth_token=${studentToken}`,
    },
  });

  const studentDashData = await studentDashRes.json();
  console.log("   Статус API дашборду:", studentDashRes.status, studentDashData.success ? "Успішно" : "Помилка");

  if (!studentDashData.success || !studentDashData.data) {
    throw new Error("Помилка API студентського дашборду: " + studentDashData.error);
  }

  const { stats, courses } = studentDashData.data;
  console.log("   Зведені показники студента:", {
    totalCourses: stats.totalCourses,
    completedCourses: stats.completedCourses,
    inProgressCourses: stats.inProgressCourses,
    totalLessonsCompleted: stats.totalLessonsCompleted,
    totalQuizzesPassed: stats.totalQuizzesPassed,
    points: stats.points,
  });

  console.log("   Кількість курсів у програмі:", courses.length);
  if (courses.length > 0) {
    const firstCourse = courses[0];
    console.log("   Деталі першого курсу:", {
      title: firstCourse.title,
      progress: `${firstCourse.completedLessons} / ${firstCourse.totalLessons} (${firstCourse.progressPercent}%)`,
      isCompleted: firstCourse.isCompleted,
      quizzesCount: firstCourse.quizzes?.length,
    });

    if (firstCourse.totalLessons === undefined || firstCourse.completedLessons === undefined) {
      throw new Error("Помилка: відсутні поля прогресу уроків у курсі!");
    }
  }

  // 3. Тест 3: HR Аналітика (GET /api/admin/analytics)
  console.log("\n3. Тестування HR Аналітики (GET /api/admin/analytics)...");
  const adminToken = await signTenantToken({
    userId: "00000000-0000-0000-0000-000000000001",
    name: "Admin Acme",
    email: "admin@acme.com",
    role: "admin",
    tenantSubdomain: "acme",
  });

  const hrAnalyticsRes = await fetch(`${BASE_URL}/api/admin/analytics?tenant=acme`, {
    headers: {
      "x-tenant-override": "acme",
      Cookie: `tenanx_auth_token=${adminToken}`,
    },
  });

  const hrAnalyticsData = await hrAnalyticsRes.json();
  console.log("   Статус HR Аналітики:", hrAnalyticsRes.status, hrAnalyticsData.success ? "Успішно" : "Помилка");

  if (!hrAnalyticsData.success || !hrAnalyticsData.data) {
    throw new Error("Помилка HR Аналітики: " + hrAnalyticsData.error);
  }

  const { summary, employees, courseMetrics } = hrAnalyticsData.data;
  console.log("   ✓ KPI компанії:", {
    totalEmployees: summary.totalEmployees,
    activeEmployeesCount: summary.activeEmployeesCount,
    avgCompletionRate: `${summary.avgCompletionRate}%`,
    avgQuizScore: `${summary.avgQuizScore}%`,
    quizPassRate: `${summary.quizPassRate}%`,
    totalPointsAwarded: summary.totalPointsAwarded,
  });

  console.log(`   ✓ Всього співробітників у матриці успішності: ${employees.length}`);
  const studentRow = employees.find((e: any) => e.email === "student@acme.com");
  console.log("   Дані по student@acme.com:", {
    name: studentRow?.name,
    points: studentRow?.points,
    lastLoginAt: studentRow?.lastLoginAt,
    coursesTracked: studentRow?.courses?.length,
  });

  if (!studentRow || studentRow.courses === undefined) {
    throw new Error("Помилка: співробітник відсутній у зведеній матриці успішності!");
  }

  // 4. Тест 4: Перевірка захисту RBAC для /api/admin/analytics
  console.log("\n4. Тестування безпеки RBAC для аналітики...");
  const unauthorizedRes = await fetch(`${BASE_URL}/api/admin/analytics?tenant=acme`, {
    headers: {
      "x-tenant-override": "acme",
      Cookie: `tenanx_auth_token=${studentToken}`, // Student token!
    },
  });

  console.log("   Спроба студента отримати доступ до HR-аналітики:", unauthorizedRes.status);
  if (unauthorizedRes.status !== 403) {
    throw new Error("Критична помилка безпеки: студент зміг отримати доступ до HR-аналітики!");
  }
  console.log("   ✓ Несанкціонований доступ успішно заблоковано (403 Forbidden)!");

  console.log("\n🎉 ВСІ ТЕСТИ ДАШБОРДІВ ТА АНАЛІТИКИ УСПІШНО ПРОЙДЕНО!");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ ТЕСТ ЗАВЕРШИВСЯ З ПОМИЛКОЮ:", err);
  process.exit(1);
});
