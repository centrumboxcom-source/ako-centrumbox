import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json(
    {
      success: true,
      message: "Сесію успішно завершено",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );

  // Clear cookie with exact matching parameters
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  response.cookies.delete(AUTH_COOKIE_NAME);

  return response;
}

export async function GET() {
  return POST();
}
