import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { masterDb } from "@/db/master";
import { invites, tenants, Invite } from "@/db/schema/master";
import { users, UserRole, TenantUser } from "@/db/schema/tenant";
import { withTenantDb } from "@/db/connection-manager";
import { hashPassword } from "@/lib/auth/password";
import { getTenantBySubdomain } from "./tenant-service";

export interface CreateInviteInput {
  tenantSubdomain: string;
  email?: string | null;
  role?: UserRole;
  expiresInHours?: number; // default 48
  maxUses?: number; // default 1 if email is set, else 50
  createdById?: string;
  createdByName?: string;
}

export interface InviteValidationResult {
  isValid: boolean;
  reason?: "not_found" | "expired" | "exhausted" | "revoked" | "tenant_inactive";
  invite?: Invite;
  tenantName?: string;
  tenantSubdomain?: string;
}

/**
 * Generate a cryptographically secure 64-character hex token.
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new invite link for a tenant.
 */
export async function createInvite(input: CreateInviteInput): Promise<Invite> {
  const subdomain = input.tenantSubdomain.trim().toLowerCase();
  const tenant = await getTenantBySubdomain(subdomain);
  if (!tenant) {
    throw new Error(`Компанію із сабдоменом '${subdomain}' не знайдено.`);
  }

  const token = generateInviteToken();
  const hours = input.expiresInHours && input.expiresInHours > 0 ? input.expiresInHours : 48;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const maxUses = input.maxUses && input.maxUses > 0 ? input.maxUses : input.email ? 1 : 50;

  const [created] = await masterDb
    .insert(invites)
    .values({
      tenantId: tenant.id,
      tenantSubdomain: subdomain,
      email: input.email ? input.email.trim().toLowerCase() : null,
      role: input.role || "student",
      token,
      maxUses,
      usesCount: 0,
      expiresAt,
      createdById:
        input.createdById &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.createdById)
          ? input.createdById
          : null,
      createdByName: input.createdByName || null,
      isRevoked: false,
    })
    .returning();

  return created;
}

/**
 * Validate an invite token.
 */
export async function validateInviteToken(token: string): Promise<InviteValidationResult> {
  const [invite] = await masterDb
    .select()
    .from(invites)
    .where(eq(invites.token, token.trim()))
    .limit(1);

  if (!invite) {
    return { isValid: false, reason: "not_found" };
  }

  if (invite.isRevoked) {
    return { isValid: false, reason: "revoked", invite };
  }

  if (new Date() > new Date(invite.expiresAt)) {
    return { isValid: false, reason: "expired", invite };
  }

  if (invite.usesCount >= invite.maxUses) {
    return { isValid: false, reason: "exhausted", invite };
  }

  const tenant = await getTenantBySubdomain(invite.tenantSubdomain);
  if (!tenant || !tenant.isActive) {
    return { isValid: false, reason: "tenant_inactive", invite };
  }

  return {
    isValid: true,
    invite,
    tenantName: tenant.name,
    tenantSubdomain: tenant.subdomain,
  };
}

/**
 * Accept an invite and provision the employee into the tenant's isolated PostgreSQL schema.
 */
export async function acceptInvite(
  token: string,
  data: { name: string; email?: string; password: string }
): Promise<{ user: TenantUser; tenantSubdomain: string; role: UserRole }> {
  const validation = await validateInviteToken(token);
  if (!validation.isValid || !validation.invite) {
    const errorMessages: Record<string, string> = {
      not_found: "Запрошення не знайдено або посилання некоректне.",
      expired: "Термін дії запрошення (24-48 годин) вичерпано. Зверніться до HR для отримання нового посилання.",
      exhausted: "Це запрошення вже було використане максимально дозволену кількість разів.",
      revoked: "Запрошення було відкликане адміністратором компанії.",
      tenant_inactive: "Простір компанії тимчасово деактивовано.",
    };
    throw new Error(errorMessages[validation.reason || "not_found"] || "Недійсне запрошення.");
  }

  const invite = validation.invite;
  const subdomain = invite.tenantSubdomain;

  // Determine email: either locked to invite.email or provided by registrant
  const targetEmail = (invite.email || data.email || "").trim().toLowerCase();
  if (!targetEmail) {
    throw new Error("Не вказано адресу електронної пошти.");
  }

  if (invite.email && invite.email.toLowerCase() !== targetEmail) {
    throw new Error(`Це запрошення призначене лише для адреси ${invite.email}.`);
  }

  if (!data.name || data.name.trim().length < 2) {
    throw new Error("Вкажіть ваше повне ім'я (мінімум 2 символи).");
  }

  if (!data.password || data.password.length < 6) {
    throw new Error("Пароль повинен містити щонайменше 6 символів.");
  }

  // Provision user into tenant schema
  const createdUser = await withTenantDb(subdomain, async (db) => {
    // 1. Check if email already registered in this tenant schema
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, targetEmail))
      .limit(1);

    if (existing) {
      throw new Error(`Користувач із поштою '${targetEmail}' уже зареєстрований у просторі компанії '${subdomain}'. Увійдіть у свій акаунт.`);
    }

    // 2. Hash password and insert
    const passwordHash = await hashPassword(data.password);
    const [newUser] = await db
      .insert(users)
      .values({
        name: data.name.trim(),
        email: targetEmail,
        passwordHash,
        role: invite.role,
        points: 0,
        lastLoginAt: new Date(),
      })
      .returning();

    return newUser;
  });

  // Increment uses count and record usedAt
  await masterDb
    .update(invites)
    .set({
      usesCount: invite.usesCount + 1,
      usedAt: new Date(),
    })
    .where(eq(invites.id, invite.id));

  return {
    user: createdUser,
    tenantSubdomain: subdomain,
    role: invite.role,
  };
}

/**
 * Get all invites for a tenant.
 */
export async function getTenantInvites(tenantSubdomain: string): Promise<Invite[]> {
  const subdomain = tenantSubdomain.trim().toLowerCase();
  return await masterDb
    .select()
    .from(invites)
    .where(eq(invites.tenantSubdomain, subdomain))
    .orderBy(desc(invites.createdAt));
}

/**
 * Revoke an invite.
 */
export async function revokeInvite(inviteId: string, tenantSubdomain: string): Promise<boolean> {
  const subdomain = tenantSubdomain.trim().toLowerCase();
  const [updated] = await masterDb
    .update(invites)
    .set({ isRevoked: true })
    .where(and(eq(invites.id, inviteId), eq(invites.tenantSubdomain, subdomain)))
    .returning();

  return !!updated;
}

/**
 * Bulk generate invites for a list of employees.
 */
export async function bulkCreateInvites(
  tenantSubdomain: string,
  items: Array<{ name?: string; email: string; role?: UserRole }>,
  options?: { expiresInHours?: number; createdById?: string; createdByName?: string }
): Promise<Array<{ email: string; token: string; invite: Invite }>> {
  const results = [];
  for (const item of items) {
    const invite = await createInvite({
      tenantSubdomain,
      email: item.email,
      role: item.role || "student",
      expiresInHours: options?.expiresInHours || 48,
      maxUses: 1,
      createdById: options?.createdById,
      createdByName: options?.createdByName,
    });
    results.push({
      email: item.email,
      token: invite.token,
      invite,
    });
  }
  return results;
}

/**
 * Bulk direct provisioning: create accounts immediately in tenant schema.
 */
export async function bulkDirectProvision(
  tenantSubdomain: string,
  items: Array<{ name: string; email: string; role?: UserRole; password?: string }>
): Promise<Array<{ name: string; email: string; role: string; password?: string; success: boolean; error?: string }>> {
  const subdomain = tenantSubdomain.trim().toLowerCase();
  const results: Array<{ name: string; email: string; role: string; password?: string; success: boolean; error?: string }> = [];

  for (const item of items) {
    const targetEmail = item.email.trim().toLowerCase();
    const role = item.role || "student";
    const password = item.password || crypto.randomBytes(4).toString("hex") + "A1!";

    try {
      await withTenantDb(subdomain, async (db) => {
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, targetEmail))
          .limit(1);

        if (existing) {
          throw new Error("Вже зареєстрований");
        }

        const passwordHash = await hashPassword(password);
        await db.insert(users).values({
          name: item.name.trim(),
          email: targetEmail,
          passwordHash,
          role,
          points: 0,
        });
      });

      results.push({
        name: item.name,
        email: targetEmail,
        role,
        password,
        success: true,
      });
    } catch (err: any) {
      results.push({
        name: item.name,
        email: targetEmail,
        role,
        success: false,
        error: err.message || "Помилка додавання",
      });
    }
  }

  return results;
}
