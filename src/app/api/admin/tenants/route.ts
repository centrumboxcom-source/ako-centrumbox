import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { masterPool } from "@/db/master";
import { getAllTenants, isSubdomainAvailable, validateSubdomainFormat } from "@/lib/services/tenant-service";
import { migrateTenantSchema, migrateMaster } from "@/lib/migrator";
import { sanitizeSchemaName } from "@/db/connection-manager";
import { hashPassword } from "@/lib/auth/password";

import { getCurrentSession } from "@/lib/auth/session";

const createTenantSchema = z.object({
  name: z.string().min(2, "Назва компанії повинна містити мінімум 2 символи").max(100),
  subdomain: z.string().min(3, "Сабдомен повинен містити мінімум 3 символи").max(63),
  adminEmail: z.union([z.string().email("Введіть коректну адресу електронної пошти"), z.literal("")]).optional(),
  adminName: z.string().min(2).optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Доступ заборонено (403). Потрібні права адміністратора." },
      { status: 403 }
    );
  }

  try {
    // Гарантуємо наявність master-таблиці
    await migrateMaster();
    const all = await getAllTenants();
    return NextResponse.json({ success: true, tenants: all });
  } catch (error) {
    console.error("Помилка отримання тенантів:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Не вдалося отримати список компаній" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Доступ заборонено. Створювати організації можуть лише адміністратори." },
      { status: 403 }
    );
  }

  let client;
  try {
    const body = await request.json();
    const parsed = createTenantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, subdomain, adminEmail, adminName } = parsed.data;
    const validation = validateSubdomainFormat(subdomain);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const normalizedSubdomain = subdomain.trim().toLowerCase();
    const safeSchema = sanitizeSchemaName(normalizedSubdomain);

    // Перевірка зайнятості сабдомену в master DB
    const available = await isSubdomainAvailable(normalizedSubdomain);
    if (!available) {
      return NextResponse.json(
        { success: false, error: `Сабдомен '${normalizedSubdomain}' вже зареєстрований.` },
        { status: 409 }
      );
    }

    client = await masterPool.connect();
    await client.query("BEGIN;");

    // 1. Додавання тенанта в Master DB
    const insertRes = await client.query(
      `INSERT INTO tenants (name, subdomain, is_active, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())
       RETURNING id, name, subdomain, is_active, created_at, updated_at;`,
      [name.trim(), normalizedSubdomain]
    );
    const newTenant = insertRes.rows[0];

    // 2. Створення схеми та застосування Drizzle міграцій
    const migrationResult = await migrateTenantSchema(safeSchema, client);

    // 3. Створення початкового адміністратора за наявності email
    if (adminEmail) {
      const defaultPasswordHash = await hashPassword("admin123");
      await client.query(
        `INSERT INTO "${safeSchema}".users (email, name, password_hash, role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (email) DO NOTHING;`,
        [adminEmail.trim().toLowerCase(), adminName ? adminName.trim() : "Адміністратор", defaultPasswordHash]
      );
    }

    await client.query("COMMIT;");

    return NextResponse.json(
      {
        success: true,
        message: `Компанію '${normalizedSubdomain}' успішно зареєстровано та створено схему.`,
        tenant: newTenant,
        schema: safeSchema,
        statementsExecuted: migrationResult.statementsExecuted,
      },
      { status: 201 }
    );
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK;");
      } catch (rbErr) {
        console.error("Помилка відкату транзакції:", rbErr);
      }
    }
    console.error("Помилка провіжинінгу тенанта:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Не вдалося виконати реєстрацію компанії",
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
