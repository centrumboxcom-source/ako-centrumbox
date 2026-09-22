import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { createInvite, getTenantInvites } from "@/lib/services/invite-service";
import { TENANT_HEADER } from "@/lib/tenant-context";

const createInviteSchema = z.object({
  email: z.string().email("Некоректний email").optional().nullable(),
  role: z.enum(["student", "instructor", "admin"]).default("student"),
  expiresInHours: z.number().min(1).max(720).default(48),
  maxUses: z.number().min(1).max(1000).default(1),
});

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER);
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function GET(request: NextRequest) {
  try {
    const subdomain = resolveSubdomain(request);
    const session = await getCurrentSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Доступ лише для адміністраторів (HR)." },
        { status: 403 }
      );
    }

    const targetSubdomain = subdomain || session.tenantSubdomain;
    if (session.tenantSubdomain.toLowerCase() !== targetSubdomain.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Міжклієнтський доступ заборонено." },
        { status: 403 }
      );
    }

    const invitesList = await getTenantInvites(targetSubdomain);

    return NextResponse.json({
      success: true,
      data: invitesList,
    });
  } catch (error: any) {
    console.error("Помилка отримання інвайтів:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const subdomain = resolveSubdomain(request);
    const session = await getCurrentSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Доступ лише для адміністраторів (HR)." },
        { status: 403 }
      );
    }

    const targetSubdomain = subdomain || session.tenantSubdomain;
    if (session.tenantSubdomain.toLowerCase() !== targetSubdomain.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Міжклієнтський доступ заборонено." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, role, expiresInHours, maxUses } = parsed.data;

    const newInvite = await createInvite({
      tenantSubdomain: targetSubdomain,
      email: email || null,
      role: role as any,
      expiresInHours,
      maxUses: email ? 1 : maxUses,
      createdById: session.userId,
      createdByName: session.name,
    });

    const origin = request.nextUrl.origin;
    const inviteUrl = `${origin}/invite/${newInvite.token}?tenant=${targetSubdomain}`;

    return NextResponse.json({
      success: true,
      message: "Інвайт-посилання успішно згенеровано",
      data: {
        ...newInvite,
        inviteUrl,
      },
    });
  } catch (error: any) {
    console.error("Помилка створення інвайту:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}
