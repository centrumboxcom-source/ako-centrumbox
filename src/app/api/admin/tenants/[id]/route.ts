import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { masterPool } from "@/db/master";
import { getCurrentSession } from "@/lib/auth/session";
import { sanitizeSchemaName } from "@/db/connection-manager";

export const dynamic = "force-dynamic";

const updateTenantSchema = z.object({
  name: z.string().min(2, "Назва повинна містити мінімум 2 символи").max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Доступ заборонено (403). Потрібні права адміністратора." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateTenantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, isActive } = parsed.data;

    // Check if tenant exists
    const existing = await masterPool.query(
      "SELECT id, name, subdomain, is_active FROM tenants WHERE id = $1",
      [id]
    );

    if (existing.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Організацію не знайдено" },
        { status: 404 }
      );
    }

    const current = existing.rows[0];
    const newName = name !== undefined ? name.trim() : current.name;
    const newIsActive = isActive !== undefined ? isActive : current.is_active;

    const updateRes = await masterPool.query(
      `UPDATE tenants
       SET name = $1, is_active = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, subdomain, is_active, created_at, updated_at;`,
      [newName, newIsActive, id]
    );

    return NextResponse.json({
      success: true,
      message: "Дані компанії успішно оновлено",
      tenant: updateRes.rows[0],
    });
  } catch (error) {
    console.error("Помилка оновлення організації:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Не вдалося оновити дані організації",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Доступ заборонено (403). Потрібні права адміністратора." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // 1. Отримуємо інформацію про організацію з master бази
    const existing = await masterPool.query(
      "SELECT id, name, subdomain FROM tenants WHERE id = $1",
      [id]
    );

    if (existing.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Організацію не знайдено або вже видалено" },
        { status: 404 }
      );
    }

    const tenant = existing.rows[0];
    const safeSchema = sanitizeSchemaName(tenant.subdomain);

    // 2. Видаляємо схему PostgreSQL в Neon (всі таблиці, користувачі, уроки, прогрес компанії)
    await masterPool.query(`DROP SCHEMA IF EXISTS "${safeSchema}" CASCADE;`);

    // 3. Видаляємо запис організації з Master DB (каскадно видаляє інвайти)
    await masterPool.query("DELETE FROM tenants WHERE id = $1;", [id]);

    return NextResponse.json({
      success: true,
      message: `Організацію '${tenant.name}' та її клієнтську схему '${tenant.subdomain}' успішно видалено з Neon PostgreSQL.`,
    });
  } catch (error) {
    console.error("Помилка видалення організації:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Не вдалося видалити організацію",
      },
      { status: 500 }
    );
  }
}
