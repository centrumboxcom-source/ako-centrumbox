import { pgTable, uuid, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { UserRole } from "./tenant";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subdomain: varchar("subdomain", { length: 63 }).notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  tenantSubdomain: varchar("tenant_subdomain", { length: 63 }).notNull(),
  email: varchar("email", { length: 255 }), // null for open team link
  role: varchar("role", { length: 50 }).default("student").notNull().$type<UserRole>(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  maxUses: integer("max_uses").default(1).notNull(),
  usesCount: integer("uses_count").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdById: uuid("created_by_id"),
  createdByName: varchar("created_by_name", { length: 255 }),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  invites: many(invites),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invites.tenantId],
    references: [tenants.id],
  }),
}));

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
