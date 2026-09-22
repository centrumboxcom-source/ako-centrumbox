import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { revokeInvite } from "@/lib/services/invite-service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inviteId = params.id;
    const session = await getCurrentSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Доступ лише для адміністраторів (HR)." },
        { status: 403 }
      );
    }

    const revoked = await revokeInvite(inviteId, session.tenantSubdomain);

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: "Інвайт не знайдено або вже відкликано" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Запрошення успішно відкликано.",
    });
  } catch (error: any) {
    console.error("Помилка відкликання інвайту:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}
