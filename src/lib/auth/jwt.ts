import { SignJWT, jwtVerify } from "jose";
import { UserRole } from "@/db/schema/tenant";

export const AUTH_COOKIE_NAME = "tenanx_auth_token";

export interface TenantTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  tenantSubdomain: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "tenanx-multi-tenant-jwt-secret-key-super-secure-32chars!";
const encodedSecret = new TextEncoder().encode(JWT_SECRET);

/**
 * Signs a JWT containing user details, role, and the bound tenant subdomain.
 */
export async function signTenantToken(payload: TenantTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedSecret);
}

/**
 * Verifies and decodes a JWT token.
 * Returns null if token is expired, tampered, or invalid.
 */
export async function verifyTenantToken(token: string): Promise<TenantTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as UserRole,
      tenantSubdomain: payload.tenantSubdomain as string,
    };
  } catch {
    return null;
  }
}
