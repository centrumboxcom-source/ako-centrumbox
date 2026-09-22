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
      // Production subdomain (e.g., "acme.example.com")
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

  // 2. Identify Protected Routes
  const isAdminRoute = (pathname.startsWith("/admin") || pathname.startsWith("/superadmin")) && !pathname.startsWith("/api/admin/tenants");
  const isLearnRoute = pathname.startsWith("/learn");
  const isProtectedRoute = isAdminRoute || isLearnRoute;

  if (isProtectedRoute) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    // No token -> Redirect to login
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      if (subdomain) loginUrl.searchParams.set("subdomain", subdomain);
      loginUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }

    // Verify JWT
    const payload = await verifyTenantToken(token);
    if (!payload) {
      // Tampered or expired token
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "session_expired");
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }

    // 3. CRITICAL: Cross-Tenant Isolation Check
    // If request is made to subdomain B with a token issued for subdomain A -> STRICTLY FORBIDDEN!
    if (subdomain && payload.tenantSubdomain.toLowerCase() !== subdomain.toLowerCase()) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "cross_tenant_forbidden");
      loginUrl.searchParams.set("userTenant", payload.tenantSubdomain);
      loginUrl.searchParams.set("targetTenant", subdomain);
      return NextResponse.redirect(loginUrl);
    }

    // 4. Role-Based Access Control (RBAC)
    if (isAdminRoute) {
      // Only 'admin' role allowed in /admin and /superadmin
      if (payload.role !== "admin") {
        const redirectUrl = new URL("/", request.url);
        redirectUrl.searchParams.set("error", "insufficient_permissions");
        return NextResponse.redirect(redirectUrl);
      }
    } else if (isLearnRoute) {
      // 'student', 'instructor', 'admin' can access /learn
      if (!["student", "instructor", "admin"].includes(payload.role)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "forbidden");
        return NextResponse.redirect(loginUrl);
      }
    }

    // Attach verified user information to downstream request headers
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-role", payload.role);
    requestHeaders.set("x-user-email", payload.email);
    requestHeaders.set("x-user-tenant", payload.tenantSubdomain);
  }

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
