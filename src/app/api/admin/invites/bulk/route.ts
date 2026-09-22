import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { bulkCreateInvites, bulkDirectProvision } from "@/lib/services/invite-service";
import { TENANT_HEADER } from "@/lib/tenant-context";

const bulkSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1, "Ім'я обов'язкове"),
      email: z.string().email("Некоректний email"),
      role: z.enum(["student", "instructor", "admin"]).default("student"),
    })
  ).min(1, "Список працівників не може бути порожнім"),
  mode: z.enum(["links", "direct"]).default("links"),
  expiresInHours: z.number().min(1).max(720).default(48),
});

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER);
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
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
    const parsed = bulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { items, mode, expiresInHours } = parsed.data;
    const origin = request.nextUrl.origin;

    if (mode === "links") {
      // Generate unique invite links for all employees
      const generated = await bulkCreateInvites(
        targetSubdomain,
        items.map((i) => ({ name: i.name, email: i.email, role: i.role as any })),
        {
          expiresInHours,
          createdById: session.userId,
          createdByName: session.name,
        }
      );

      const itemsWithLinks = generated.map((g) => {
        const matching = items.find((i) => i.email.toLowerCase() === g.email.toLowerCase());
        return {
          name: matching?.name || "",
          email: g.email,
          role: g.invite.role,
          token: g.token,
          expiresAt: g.invite.expiresAt,
          inviteUrl: `${origin}/invite/${g.token}?tenant=${targetSubdomain}`,
        };
      });

      return NextResponse.json({
        success: true,
        mode: "links",
        count: itemsWithLinks.length,
        message: `Успішно згенеровано ${itemsWithLinks.length} індивідуальних інвайтів!`,
        data: itemsWithLinks,
      });
    } else {
      // Direct provisioning in tenant schema
      const directResults = await bulkDirectProvision(
        targetSubdomain,
        items.map((i) => ({
          name: i.name,
          email: i.email,
          role: i.role as any,
        }))
      );

      const successCount = directResults.filter((r) => r.success).length;

      return NextResponse.json({
        success: true,
        mode: "direct",
        count: directResults.length,
        successCount,
        message: `Успішно зареєстровано ${successCount} із ${directResults.length} працівників.`,
        data: directResults,
      });
    }
  } catch (error: any) {
    console.error("Помилка масового імпорту:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Помилка сервера при масовому імпорті" },
      { status: 500 }
    );
  }
}
