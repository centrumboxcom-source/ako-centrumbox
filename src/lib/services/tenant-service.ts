import { eq } from "drizzle-orm";
import { masterDb } from "@/db/master";
import { tenants, Tenant, NewTenant } from "@/db/schema/master";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "dashboard",
  "mail",
  "ftp",
  "localhost",
  "public",
  "master",
  "control",
]);

export function validateSubdomainFormat(subdomain: string): { valid: boolean; error?: string } {
  const normalized = subdomain.trim().toLowerCase();
  
  if (normalized.length < 3 || normalized.length > 63) {
    return { valid: false, error: "Довжина сабдомену повинна бути від 3 до 63 символів." };
  }

  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(normalized)) {
    return {
      valid: false,
      error: "Сабдомен може містити лише латинські літери, цифри, дефіси та підкреслення, і не може починатися або закінчуватися спецсимволом.",
    };
  }

  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return { valid: false, error: `'${normalized}' є зарезервованим системним сабдоменом.` };
  }

  return { valid: true };
}

export async function getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
  const normalized = subdomain.trim().toLowerCase();
  const [tenant] = await masterDb
    .select()
    .from(tenants)
    .where(eq(tenants.subdomain, normalized))
    .limit(1);

  return tenant ?? null;
}

export async function getAllTenants(): Promise<Tenant[]> {
  return await masterDb.select().from(tenants).orderBy(tenants.createdAt);
}

export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  const validation = validateSubdomainFormat(subdomain);
  if (!validation.valid) return false;

  const existing = await getTenantBySubdomain(subdomain);
  return existing === null;
}
