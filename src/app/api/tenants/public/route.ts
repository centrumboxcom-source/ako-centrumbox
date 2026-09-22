import { NextResponse } from "next/server";
import { masterDb } from "@/db/master";
import { tenants } from "@/db/schema/master";
import { eq } from "drizzle-orm";
import { migrateMaster } from "@/lib/migrator";

export async function GET() {
  try {
    await migrateMaster();
    // Return only public non-sensitive organization data for login selector
    const activeTenants = await masterDb
      .select({
        id: tenants.id,
        name: tenants.name,
        subdomain: tenants.subdomain,
      })
      .from(tenants)
      .where(eq(tenants.isActive, true))
      .orderBy(tenants.name);

    return NextResponse.json({ success: true, tenants: activeTenants });
  } catch (error) {
    console.error("Public tenants fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Не вдалося отримати список організацій" },
      { status: 500 }
    );
  }
}
