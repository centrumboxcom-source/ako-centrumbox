import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { acceptInvite } from "@/lib/services/invite-service";
import { signTenantToken, AUTH_COOKIE_NAME } from "@/lib/auth/jwt";

const acceptInviteSchema = z.object({
  name: z.string().min(2, "Ім'я повинно містити щонайменше 2 символи"),
  email: z.string().email("Введіть коректну адресу email").optional(),
  password: z.string().min(6, "Пароль повинен містити щонайменше 6 символів"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Токен запрошення обов'язковий" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = acceptInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Accept invite and provision into tenant's database schema
    const { user, tenantSubdomain, role } = await acceptInvite(token, {
      name,
      email,
      password,
    });

    // Sign JWT token for the newly registered employee
    const authToken = await signTenantToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: role,
      tenantSubdomain,
    });

    // Prepare response with auth cookie
    const response = NextResponse.json({
      success: true,
      message: `Вітаємо, ${user.name}! Ваш акаунт успішно створено.`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantSubdomain,
      },
      redirect: `/learn?tenant=${tenantSubdomain}`,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: authToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error("Помилка реєстрації за інвайтом:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Помилка при реєстрації за запрошенням",
      },
      { status: 400 }
    );
  }
}
