import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { TENANT_HEADER } from "@/lib/tenant-context";
import { sanitizeSchemaName } from "@/db/connection-manager";

export async function POST(request: NextRequest) {
  try {
    const subdomain = (
      request.headers.get(TENANT_HEADER) ||
      request.headers.get("x-tenant-override") ||
      request.nextUrl.searchParams.get("tenant") ||
      ""
    ).trim().toLowerCase();

    if (!subdomain) {
      return NextResponse.json(
        { success: false, error: "Не вказано сабдомен компанії для завантаження файлу." },
        { status: 400 }
      );
    }

    const safeTenant = sanitizeSchemaName(subdomain);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Файл не надано у формі." },
        { status: 400 }
      );
    }

    // Limit size to 25MB
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "Розмір файлу перевищує ліміт 25MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate safe unique filename
    const cleanFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${cleanFilename}`;

    // Target upload folder isolated by tenant: public/uploads/tenants/{safeTenant}/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tenants", safeTenant);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/tenants/${safeTenant}/${uniqueName}`;

    return NextResponse.json({
      success: true,
      message: `Файл успішно завантажено в простір компанії '${safeTenant}'`,
      url: publicUrl,
      filename: uniqueName,
      size: file.size,
      type: file.type,
      tenant: safeTenant,
    });
  } catch (error) {
    console.error("Помилка завантаження медіа:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка завантаження файлу" },
      { status: 500 }
    );
  }
}
