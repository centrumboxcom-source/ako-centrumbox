import { NextRequest, NextResponse } from "next/server";
import { validateInviteToken } from "@/lib/services/invite-service";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    if (!token) {
      return NextResponse.json(
        { success: false, valid: false, error: "Токен запрошення відсутній." },
        { status: 400 }
      );
    }

    const validation = await validateInviteToken(token);

    if (!validation.isValid || !validation.invite) {
      const errorMap: Record<string, string> = {
        not_found: "Запрошення не знайдено або посилання некоректне.",
        expired: "Термін дії запрошення (24-48 годин) вичерпано. Зверніться до вашого HR-менеджера для отримання нового посилання.",
        exhausted: "Це посилання-запрошення вже було використане.",
        revoked: "Це запрошення було відкликане адміністратором компанії.",
        tenant_inactive: "Простір компанії тимчасово заблоковано.",
      };

      return NextResponse.json({
        success: false,
        valid: false,
        reason: validation.reason,
        error: errorMap[validation.reason || "not_found"] || "Недійсне посилання-запрошення.",
      });
    }

    const invite = validation.invite;

    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        usesCount: invite.usesCount,
        tenantSubdomain: invite.tenantSubdomain,
        tenantName: validation.tenantName,
      },
    });
  } catch (error: any) {
    console.error("Помилка перевірки інвайту:", error);
    return NextResponse.json(
      { success: false, valid: false, error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}
