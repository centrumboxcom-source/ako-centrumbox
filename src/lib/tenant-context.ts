import { headers } from "next/headers";

export const TENANT_HEADER = "x-tenant-subdomain";

/**
 * Retrieves the current tenant's subdomain from incoming request headers.
 * Works inside Next.js Server Components, Server Actions, and Route Handlers.
 */
export function getTenantSubdomain(): string | null {
  const headerList = headers();
  const tenant = headerList.get(TENANT_HEADER);
  if (!tenant || tenant === "" || tenant === "null" || tenant === "undefined") {
    return null;
  }
  return tenant.trim().toLowerCase();
}

/**
 * Requires a tenant subdomain or throws an error (for protected tenant routes).
 */
export function requireTenantSubdomain(): string {
  const subdomain = getTenantSubdomain();
  if (!subdomain) {
    throw new Error("Tenant subdomain header (x-tenant-subdomain) is required for this operation.");
  }
  return subdomain;
}
