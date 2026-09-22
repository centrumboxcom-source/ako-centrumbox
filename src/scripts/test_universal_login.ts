async function testAll() {
  const base = "http://localhost:3000";

  console.log("=== TEST 1: Strict Unauthenticated Redirects ===");
  const rRoot = await fetch(base + "/", { redirect: "manual" });
  console.log("Unauth / ->", rRoot.status, rRoot.headers.get("location"));

  const rLearn = await fetch(base + "/learn", { redirect: "manual" });
  console.log("Unauth /learn ->", rLearn.status, rLearn.headers.get("location"));

  const rAdmin = await fetch(base + "/admin", { redirect: "manual" });
  console.log("Unauth /admin ->", rAdmin.status, rAdmin.headers.get("location"));

  console.log("\n=== TEST 2: Universal Smart Login ===");
  // Student Acme
  const sRes = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "student@acme.com", password: "password123" }),
  });
  const sData = await sRes.json();
  console.log("student@acme.com ->", sData.success, sData.user?.role, sData.user?.tenantSubdomain, sData.redirectTo);

  // Admin Acme
  const aRes = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@acme.com", password: "admin123" }),
  });
  const aData = await aRes.json();
  console.log("admin@acme.com ->", aData.success, aData.user?.role, aData.user?.tenantSubdomain, aData.redirectTo);

  // Admin Globex
  const gRes = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@globex.com", password: "admin123" }),
  });
  const gData = await gRes.json();
  console.log("admin@globex.com ->", gData.success, gData.user?.role, gData.user?.tenantSubdomain, gData.redirectTo);

  // Admin Nova
  const nRes = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@nova.com", password: "admin123" }),
  });
  const nData = await nRes.json();
  console.log("admin@nova.com ->", nData.success, nData.user?.role, nData.user?.tenantSubdomain, nData.redirectTo);

  console.log("\n=== TEST 3: Login Page HTML Verification ===");
  const loginHtmlRes = await fetch(base + "/login");
  const loginHtml = await loginHtmlRes.text();
  console.log('Contains "Швидкий тестовий":', loginHtml.includes("Швидкий тестовий"));
  console.log('Contains "admin123":', loginHtml.includes("admin123"));
  console.log('Contains "Сабдомен":', loginHtml.includes("Сабдомен"));
  console.log('Contains "Робочий Email":', loginHtml.includes("Робочий Email"));
}

testAll().catch(console.error);
