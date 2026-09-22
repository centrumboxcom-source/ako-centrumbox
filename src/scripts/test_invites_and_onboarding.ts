import { createInvite, validateInviteToken, acceptInvite } from "../lib/services/invite-service";
import { withTenantDb } from "../db/connection-manager";
import { users } from "../db/schema/tenant";
import { masterDb } from "../db/master";
import { invites } from "../db/schema/master";
import { eq } from "drizzle-orm";
import { signTenantToken, verifyTenantToken } from "../lib/auth/jwt";

const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=== ПОЧАТОК ТЕСТУВАННЯ СИСТЕМИ ІНВАЙТІВ ТА ONBOARDING ===");

  // 1. Очищення старих тестових користувачів у схемі 'acme'
  await withTenantDb("acme", async (db) => {
    await db.delete(users).where(eq(users.email, "invitee_single@acme.com"));
    await db.delete(users).where(eq(users.email, "team_user_1@acme.com"));
    await db.delete(users).where(eq(users.email, "team_user_2@acme.com"));
    await db.delete(users).where(eq(users.email, "csv_tkach@acme.com"));
    await db.delete(users).where(eq(users.email, "csv_bondar@acme.com"));
    await db.delete(users).where(eq(users.email, "direct_user@acme.com"));
  });

  // 2. Тест 1: Генерація індивідуального інвайту
  console.log("\n1. Тестування генерації інвайту для конкретного email...");
  const inviteSingle = await createInvite({
    tenantSubdomain: "acme",
    email: "invitee_single@acme.com",
    role: "student",
    expiresInHours: 48,
    maxUses: 1,
    createdByName: "HR Admin",
  });

  console.log("   ✓ Інвайт створено в Master DB:", {
    id: inviteSingle.id,
    token: inviteSingle.token.slice(0, 16) + "...",
    email: inviteSingle.email,
    expiresAt: inviteSingle.expiresAt,
    maxUses: inviteSingle.maxUses,
  });

  if (inviteSingle.maxUses !== 1 || !inviteSingle.token) {
    throw new Error("Помилка: невірні параметри створеного інвайту!");
  }

  // 3. Тест 2: Перевірка валідності токена через API
  console.log("\n2. Тестування API перевірки токена (GET /api/invites/[token])...");
  const checkRes = await fetch(`${BASE_URL}/api/invites/${inviteSingle.token}`);
  const checkData = await checkRes.json();
  console.log("   Статус API:", checkRes.status, checkData.success ? "Успішно" : "Помилка");
  console.log("   Дані компанії:", {
    tenantName: checkData.data?.tenantName,
    tenantSubdomain: checkData.data?.tenantSubdomain,
    role: checkData.data?.role,
    email: checkData.data?.email,
  });

  if (!checkData.valid || checkData.data?.tenantSubdomain !== "acme") {
    throw new Error("Помилка: API не підтвердив валідність токена!");
  }

  // 4. Тест 3: Реєстрація працівника за посиланням (POST /api/invites/[token]/accept)
  console.log("\n3. Тестування реєстрації співробітника за інвайтом...");
  const acceptRes = await fetch(`${BASE_URL}/api/invites/${inviteSingle.token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ігор Онопко",
      email: "invitee_single@acme.com",
      password: "StrongPassword2026!",
    }),
  });

  const acceptData = await acceptRes.json();
  console.log("   Статус реєстрації:", acceptRes.status, acceptData.message);
  console.log("   Створений користувач:", acceptData.user);

  if (!acceptData.success || acceptData.user?.email !== "invitee_single@acme.com") {
    throw new Error("Помилка: реєстрація за інвайтом провалилась!");
  }

  // Перевірка в базі даних Neon (схема acme)
  const dbUser = await withTenantDb("acme", async (db) => {
    const [u] = await db.select().from(users).where(eq(users.email, "invitee_single@acme.com"));
    return u;
  });

  console.log("   ✓ Користувача фізично знайдено в схемі 'acme.users':", {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    points: dbUser.points,
    role: dbUser.role,
  });

  if (!dbUser || dbUser.points !== 0) {
    throw new Error("Помилка: користувач не збережений у tenant-схемі або має некоректні бали!");
  }

  // 5. Тест 4: Захист від повторного використання одноразового інвайту
  console.log("\n4. Тестування захисту від повторного використання інвайту...");
  const replayRes = await fetch(`${BASE_URL}/api/invites/${inviteSingle.token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Шахрай",
      email: "attacker@acme.com",
      password: "AnotherPassword123!",
    }),
  });

  const replayData = await replayRes.json();
  console.log("   Відповідь на повторну спробу:", replayRes.status, replayData.error);
  if (replayRes.status === 200 || replayData.success) {
    throw new Error("Критична вразливість: одноразове посилання дозволило повторну реєстрацію!");
  }
  console.log("   ✓ Повторну спробу успішно заблоковано!");

  // 6. Тест 5: Багаторазове командне посилання (Team Link)
  console.log("\n5. Тестування командного посилання (Team Link, ліміт: 2)...");
  const teamInvite = await createInvite({
    tenantSubdomain: "acme",
    email: null, // відкрите посилання
    role: "student",
    expiresInHours: 48,
    maxUses: 2,
    createdByName: "Team Lead",
  });

  // Перший співробітник
  await fetch(`${BASE_URL}/api/invites/${teamInvite.token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Користувач А",
      email: "team_user_1@acme.com",
      password: "Password123!",
    }),
  });

  // Другий співробітник
  await fetch(`${BASE_URL}/api/invites/${teamInvite.token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Користувач Б",
      email: "team_user_2@acme.com",
      password: "Password123!",
    }),
  });

  // Третя спроба (повинна бути заблокована, бо ліміт 2)
  const exhaustedRes = await fetch(`${BASE_URL}/api/invites/${teamInvite.token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Користувач В",
      email: "team_user_3@acme.com",
      password: "Password123!",
    }),
  });

  const exhaustedData = await exhaustedRes.json();
  console.log("   Спроба перевищити ліміт командного посилання:", exhaustedRes.status, exhaustedData.error);
  if (exhaustedRes.status === 200 || exhaustedData.success) {
    throw new Error("Помилка: ліміт командного посилання не спрацював!");
  }
  console.log("   ✓ Ліміт використань командного посилання спрацював чітко!");

  // 7. Тест 6: Пакетний імпорт CSV (Admin Bulk API)
  console.log("\n6. Тестування масового Onboarding через Admin Bulk API...");
  // Генеруємо сесійний токен для адміна acme
  const adminToken = await signTenantToken({
    userId: "d3b07384-d113-4602-9c91-236b32a76f28",
    name: "Admin Acme",
    email: "admin@acme.com",
    role: "admin",
    tenantSubdomain: "acme",
  });

  const bulkRes = await fetch(`${BASE_URL}/api/admin/invites/bulk?tenant=acme`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-override": "acme",
      Cookie: `tenanx_auth_token=${adminToken}`,
    },
    body: JSON.stringify({
      items: [
        { name: "Оксана Ткач", email: "csv_tkach@acme.com", role: "student" },
        { name: "Сергій Бондар", email: "csv_bondar@acme.com", role: "instructor" },
      ],
      mode: "links",
      expiresInHours: 48,
    }),
  });

  const bulkData = await bulkRes.json();
  console.log("   Результат масової генерації:", bulkRes.status, bulkData.message);
  console.log("   Згенеровано посилань:", bulkData.count);
  if (!bulkData.success || bulkData.count !== 2) {
    throw new Error("Помилка масової генерації інвайтів!");
  }
  console.log("   Приклад згенерованого посилання:", bulkData.data?.[0]?.inviteUrl);

  // 8. Тест 7: Пряме створення акаунтів (Direct Provisioning)
  console.log("\n7. Тестування прямого масового створення акаунтів...");
  const directRes = await fetch(`${BASE_URL}/api/admin/invites/bulk?tenant=acme`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-override": "acme",
      Cookie: `tenanx_auth_token=${adminToken}`,
    },
    body: JSON.stringify({
      items: [
        { name: "Прямий Працівник", email: "direct_user@acme.com", role: "student" },
      ],
      mode: "direct",
    }),
  });

  const directData = await directRes.json();
  console.log("   Результат прямого створення:", directRes.status, directData.message);
  console.log("   Створений запис з паролем:", {
    email: directData.data?.[0]?.email,
    password: directData.data?.[0]?.password,
    success: directData.data?.[0]?.success,
  });

  if (!directData.success || !directData.data?.[0]?.success) {
    throw new Error("Помилка прямого створення акаунта!");
  }

  // 9. Тест 8: Перевірка списку співробітників компанії
  console.log("\n8. Тестування отримання списку співробітників (GET /api/admin/users)...");
  const usersRes = await fetch(`${BASE_URL}/api/admin/users?tenant=acme`, {
    headers: {
      "x-tenant-override": "acme",
      Cookie: `tenanx_auth_token=${adminToken}`,
    },
  });

  const usersData = await usersRes.json();
  console.log("   Всього співробітників у компанії 'acme':", usersData.data?.length);
  const foundInvitee = usersData.data?.find((u: any) => u.email === "invitee_single@acme.com");
  console.log("   Знайдено зареєстрованого за інвайтом:", foundInvitee ? "Так" : "Ні");

  if (!foundInvitee) {
    throw new Error("Помилка: співробітник відсутній у списку користувачів компанії!");
  }

  console.log("\n🎉 ВСІ ТЕСТИ СИСТЕМИ ІНВАЙТІВ ТА ONBOARDING УСПІШНО ПРОЙДЕНО!");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ ТЕСТ ЗАВЕРШИВСЯ З ПОМИЛКОЮ:", err);
  process.exit(1);
});
