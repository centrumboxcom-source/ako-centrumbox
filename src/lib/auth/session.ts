import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyTenantToken, TenantTokenPayload } from "./jwt";
import { UserRole } from "@/db/schema/tenant";

/**
 * Retrieves and validates the active tenant session from HTTP cookies.
 * Usable inside Server Components, Server Actions, and Route Handlers.
 */
export async function getCurrentSession(): Promise<TenantTokenPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;
  return await verifyTenantToken(token);
}

/**
 * Requires an authenticated user or throws an unauthorized error.
 */
export async function requireAuth(): Promise<TenantTokenPayload> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Необхідна авторизація");
  }
  return session;
}

/**
 * Requires an authenticated user with a specific role, optionally validating tenant bound.
 */
export async function requireRole(
  allowedRoles: UserRole[],
  expectedTenant?: string
): Promise<TenantTokenPayload> {
  const session = await requireAuth();

  if (expectedTenant && session.tenantSubdomain !== expectedTenant.toLowerCase().trim()) {
    throw new Error("Міжклієнтський доступ заборонено. Сесія належить іншій компанії.");
  }

  if (!allowedRoles.includes(session.role)) {
    throw new Error(`Доступ заборонено для вашої ролі (${session.role}). Потрібна роль: ${allowedRoles.join(" або ")}.`);
  }

  return session;
}
