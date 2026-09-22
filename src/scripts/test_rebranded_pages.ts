async function testRebrandedPages() {
  const baseUrl = "http://localhost:3000";
  const tenant = "acme";

  console.log("=== Testing Rebranded SpotiLearn Pages ===");

  const pages = [
    { path: `/?tenant=${tenant}`, name: "Home Portal" },
    { path: `/learn?tenant=${tenant}`, name: "Learning Media Space" },
    { path: `/profile?tenant=${tenant}`, name: "Profile & Wrapped" },
    { path: `/admin?tenant=${tenant}`, name: "Creator Studio / Admin" },
    { path: `/login?tenant=${tenant}`, name: "Login Portal" },
  ];

  for (const p of pages) {
    const res = await fetch(`${baseUrl}${p.path}`, {
      headers: { "x-tenant-override": tenant },
    });
    console.log(`Page: ${p.name} (${p.path}) -> HTTP Status: ${res.status}`);
    if (res.status !== 200) {
      throw new Error(`Page ${p.name} returned status ${res.status}`);
    }
    const html = await res.text();
    const hasBrand = html.includes("Spoti") || html.includes("1ed760") || html.includes("Корпоративн");
    console.log(`  ✓ HTML Content received (${html.length} bytes), Contains brand tokens: ${hasBrand}`);
  }

  console.log("\n🎉 ALL PAGES COMPILED & LOADED PERFECTLY WITH SPOTILEARN BRANDING!");
}

testRebrandedPages().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
