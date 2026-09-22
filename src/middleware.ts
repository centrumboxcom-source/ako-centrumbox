import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyTenantToken, AUTH_COOKIE_NAME } from "@/lib/auth/jwt";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;
  const hostname = request.headers.get("host") || "";

  // 1. Resolve Subdomain (from dev override, query param, or host header)
  const headerOverride = request.headers.get("x-tenant-override");
  const queryOverride = url.searchParams.get("__tenant") || url.searchParams.get("tenant");
  let subdomain: string | null = headerOverride || queryOverride || null;

  if (!subdomain) {
    const hostWithoutPort = hostname.split(":")[0].toLowerCase();
    const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000").split(":")[0].toLowerCase();

    // Check for localhost subdomains (e.g., "acme.localhost")
    if (hostWithoutPort.endsWith(".localhost")) {
      const parts = hostWithoutPort.split(".");
      if (parts.length >= 2 && parts[0] !== "www" && parts[0] !== "api") {
        subdomain = parts[0];
      }
    } else if (hostWithoutPort !== rootDomain && hostWithoutPort.endsWith(`.${rootDomain}`)) {
      const candidate = hostWithoutPort.slice(0, -(rootDomain.length + 1));
      if (candidate && candidate !== "www" && candidate !== "api") {
        subdomain = candidate;
      }
    }
  }

  // Clone request headers to propagate context
  const requestHeaders = new Headers(request.headers);
  if (subdomain) {
    requestHeaders.set("x-tenant-subdomain", subdomain.toLowerCase());
  }

  // 2. Identify Public vs Protected Routes
  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/tenants/public");

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // If visiting /login while already authenticated -> redirect to appropriate workspace
  if (pathname === "/login" && token) {
    const payload = await verifyTenantToken(token);
    if (payload) {
      const targetWorkspace =
        payload.role === "admin"
          ? (payload.tenantSubdomain === "master" ? "/superadmin" : `/admin?tenant=${encodeURIComponent(payload.tenantSubdomain)}`)
          : `/learn?tenant=${encodeURIComponent(payload.tenantSubdomain)}`;
      return NextResponse.redirect(new URL(targetWorkspace, request.url));
    }
  }

  // If public route, allow downstream
  if (isPublicRoute) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 3. All other routes (/, /learn, /admin, /profile, /superadmin, etc.) REQUIRE AUTHENTICATION!
  if (!token) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { success: false, error: "Потрібна авторизація" },
        { status: 401 }
      );
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }

    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    if (subdomain) {
      loginUrl.searchParams.set("tenant", subdomain);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT
  const payload = await verifyTenantToken(token);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { success: false, error: "Сесія недійсна або термін дії вичерпано" },
        { status: 401 }
      );
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }

    // Tampered or expired token -> flush cookie & redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "session_expired");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  // If SuperAdmin visits root "/" without explicit tenant param, direct to /superadmin console
  if (pathname === "/" && payload.tenantSubdomain === "master" && !url.searchParams.has("tenant")) {
    return NextResponse.redirect(new URL("/superadmin", request.url));
  }

  // 4. Cross-Tenant Isolation Check (non-admins cannot access other tenant subdomains)
  if (subdomain && payload.tenantSubdomain.toLowerCase() !== subdomain.toLowerCase()) {
    if (payload.role !== "admin") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "cross_tenant_forbidden");
      loginUrl.searchParams.set("userTenant", payload.tenantSubdomain);
      loginUrl.searchParams.set("targetTenant", subdomain);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 5. Role-Based Access Control (RBAC)
  const isAdminRoute =
    (pathname.startsWith("/admin") || pathname.startsWith("/superadmin")) &&
    !pathname.startsWith("/api/admin/tenants");

  if (isAdminRoute) {
    // Only 'admin' role allowed in /admin and /superadmin
    if (payload.role !== "admin") {
      const redirectUrl = new URL("/learn", request.url);
      redirectUrl.searchParams.set("tenant", payload.tenantSubdomain);
      redirectUrl.searchParams.set("error", "insufficient_permissions");
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Attach verified user information to downstream request headers
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-tenant", payload.tenantSubdomain);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static images / assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
