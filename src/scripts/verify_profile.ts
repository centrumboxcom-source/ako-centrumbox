import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function verifyProfile() {
  const baseUrl = "http://localhost:3000";
  const tenant = "acme";

  console.log("=== Verifying Profile API for admin@acme.com ===");
  const res = await fetch(`${baseUrl}/api/profile?tenant=${tenant}&email=admin@acme.com`, {
    headers: { "x-tenant-override": tenant },
  });

  const data = await res.json();
  console.log("Profile Response Status:", res.status);
  console.log("Profile Data Success:", data.success);

  if (!data.success) {
    throw new Error("Profile API returned error: " + data.error);
  }

  const { user, stats, history } = data.data;
  console.log("\nUser Info:", {
    name: user.name,
    email: user.email,
    points: user.points,
    rank: user.rank.title,
    badge: user.rank.badge,
  });

  console.log("\nStats Info:", {
    lessonsCompleted: stats.lessonsCompleted,
    quizzesPassed: stats.quizzesPassed,
    averageQuizScore: stats.averageQuizScore,
    totalActivities: stats.totalActivities,
  });

  console.log("\nActivity History (Count: " + history.length + "):");
  for (const item of history) {
    console.log(`- [${item.activityType.toUpperCase()}] "${item.title}": score=${item.score}%, passed=${item.passed}, +${item.pointsAwarded} балів, date=${item.completedAt}`);
  }

  if (user.points !== 50) {
    throw new Error(`Expected points 50, got ${user.points}`);
  }
  if (stats.quizzesPassed !== 1) {
    throw new Error(`Expected quizzesPassed 1, got ${stats.quizzesPassed}`);
  }
  if (history.length !== 3) {
    throw new Error(`Expected history length 3, got ${history.length}`);
  }

  console.log("\n✅ ALL PROFILE CHECKS PASSED PERFECTLY!");
}

verifyProfile().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
