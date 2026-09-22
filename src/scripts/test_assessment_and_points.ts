import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function runTests() {
  const baseUrl = "http://localhost:3000";
  const tenant = "acme";
  console.log("=== Testing Assessment Engine & Gamification Points System ===");

  // 1. Get courses in acme
  console.log("\n1. Fetching existing courses in tenant 'acme'...");
  const coursesRes = await fetch(`${baseUrl}/api/courses?tenant=${tenant}`, {
    headers: { "x-tenant-override": tenant },
  });
  const coursesData = await coursesRes.json();
  if (!coursesData.success || coursesData.data.length === 0) {
    throw new Error("No courses found in tenant acme");
  }
  const course = coursesData.data[0];
  console.log(`Using course: "${course.title}" (${course.id})`);

  // 2. Create a Quiz for this course
  console.log("\n2. Creating a new quiz for the course...");
  const createQuizRes = await fetch(`${baseUrl}/api/courses/${course.id}/quizzes?tenant=${tenant}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-override": tenant },
    body: JSON.stringify({
      title: "Контрольний тест: Архітектура Multi-tenant",
      description: "Тест для перевірки знань концепції schema-per-tenant та безпеки з'єднань.",
      passingScore: 70,
      rewardPoints: 30,
    }),
  });
  const quizData = await createQuizRes.json();
  console.log("Quiz created:", quizData.success, quizData.data?.id);
  const quizId = quizData.data.id;

  // 3. Populate Questions (Single Choice + Multiple Choice)
  console.log("\n3. Adding questions and options (Single Choice + Multiple Choice)...");
  const updateQuizRes = await fetch(`${baseUrl}/api/quizzes/${quizId}?tenant=${tenant}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-tenant-override": tenant },
    body: JSON.stringify({
      questions: [
        {
          questionText: "Яка команда використовується для ізоляції пошуку схеми в межах транзакції PostgreSQL?",
          questionType: "single",
          points: 1,
          order: 1,
          explanation: "SET LOCAL діє виключно в межах поточної транзакції та запобігає забрудненню пулу.",
          options: [
            { optionText: 'SET LOCAL search_path TO "tenant", public;', isCorrect: true, order: 1 },
            { optionText: "DROP DATABASE multitenant;", isCorrect: false, order: 2 },
            { optionText: "ALTER USER postgres WITH SUPERUSER;", isCorrect: false, order: 3 },
          ],
        },
        {
          questionText: "Які переваги надає підхід Schema-per-Tenant в PostgreSQL?",
          questionType: "multiple",
          points: 2,
          order: 2,
          explanation: "Підхід schema-per-tenant гарантує логічну ізоляцію та швидкі бекапи окремих клієнтів.",
          options: [
            { optionText: "Повна ізоляція даних між організаціями", isCorrect: true, order: 1 },
            { optionText: "Можливість індивідуальних міграцій схем", isCorrect: true, order: 2 },
            { optionText: "Неможливість використання загального пулу з'єднань", isCorrect: false, order: 3 },
          ],
        },
      ],
    }),
  });
  const updatedQuiz = await updateQuizRes.json();
  console.log("Quiz updated with questions:", updatedQuiz.success);

  // 4. Zero-Cheat Security Check (Student view)
  console.log("\n4. Verifying Zero-Cheat Policy (isCorrect must NOT be exposed to students)...");
  const studentQuizRes = await fetch(`${baseUrl}/api/quizzes/${quizId}?tenant=${tenant}`);
  const studentQuizData = await studentQuizRes.json();
  const firstQuestion = studentQuizData.data.questions[0];
  const firstOption = firstQuestion.options[0];

  const hasIsCorrect = "isCorrect" in firstOption;
  const hasExplanation = firstQuestion.explanation !== null;

  console.log("Is `isCorrect` exposed in options?", hasIsCorrect);
  console.log("Is `explanation` exposed before submission?", hasExplanation);
  if (hasIsCorrect || hasExplanation) {
    throw new Error("SECURITY FAILURE: Student endpoint leaked answers or explanation!");
  }
  console.log("🛡️ Zero-Cheat Verified: Correct answers and explanations are 100% stripped from client!");

  // Save the option IDs for submission test
  const q1 = studentQuizData.data.questions[0];
  const q2 = studentQuizData.data.questions[1];
  const q1CorrectOptionId = q1.options[0].id; // "SET LOCAL..."
  const q2CorrectOptionId1 = q2.options[0].id; // "Повна ізоляція..."
  const q2CorrectOptionId2 = q2.options[1].id; // "Можливість індивідуальних..."

  // 5. Test Lesson Completion & Gamification Points
  console.log("\n5. Testing lesson completion & points reward (+10 points)...");
  const lessonsRes = await fetch(`${baseUrl}/api/courses/${course.id}/lessons?tenant=${tenant}`, {
    headers: { "x-tenant-override": tenant },
  });
  const lessonsData = await lessonsRes.json();
  const lesson = lessonsData.data[0];

  const completeLessonRes = await fetch(
    `${baseUrl}/api/courses/${course.id}/lessons/${lesson.id}/complete?tenant=${tenant}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-override": tenant },
      body: JSON.stringify({ userEmail: "student@acme.com" }),
    }
  );
  const completeLessonData = await completeLessonRes.json();
  console.log("Lesson complete response (1st time):", completeLessonData.data);
  if (completeLessonData.data.pointsAwarded !== 10) {
    throw new Error("Expected 10 points awarded for lesson completion");
  }

  // Repeat completion to verify idempotency
  console.log("Verifying idempotency (re-completing the same lesson)...");
  const repeatCompleteRes = await fetch(
    `${baseUrl}/api/courses/${course.id}/lessons/${lesson.id}/complete?tenant=${tenant}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-override": tenant },
      body: JSON.stringify({ userEmail: "student@acme.com" }),
    }
  );
  const repeatCompleteData = await repeatCompleteRes.json();
  console.log("Lesson complete response (2nd time):", repeatCompleteData.data);
  if (repeatCompleteData.data.pointsAwarded !== 0 || !repeatCompleteData.data.alreadyCompleted) {
    throw new Error("Idempotency failure: Points awarded twice for the same lesson!");
  }
  console.log("✅ Idempotency Verified: Points cannot be farmed by re-completing lessons.");

  // 6. Test Quiz Evaluation & Secure Backend Grading
  console.log("\n6. Submitting test answers for backend evaluation...");
  const submitRes = await fetch(`${baseUrl}/api/quizzes/${quizId}/submit?tenant=${tenant}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-override": tenant },
    body: JSON.stringify({
      userEmail: "student@acme.com",
      answers: {
        [q1.id]: [q1CorrectOptionId],
        [q2.id]: [q2CorrectOptionId1, q2CorrectOptionId2],
      },
    }),
  });
  const submitData = await submitRes.json();
  console.log("Quiz evaluation response:", {
    success: submitData.success,
    score: submitData.data.score,
    passed: submitData.data.passed,
    pointsAwarded: submitData.data.pointsAwarded,
    userTotalPoints: submitData.data.userTotalPoints,
  });

  if (submitData.data.score !== 100 || !submitData.data.passed || submitData.data.pointsAwarded !== 30) {
    throw new Error(`Grading mismatch: score=${submitData.data.score}, pointsAwarded=${submitData.data.pointsAwarded}`);
  }
  console.log("✅ Backend Grading Verified: 100% score computed and +30 reward points awarded!");

  // 7. Verify Profile API
  console.log("\n7. Verifying User Profile & Points Balance (/api/profile)...");
  const profileRes = await fetch(`${baseUrl}/api/profile?tenant=${tenant}&email=student@acme.com`, {
    headers: { "x-tenant-override": tenant },
  });
  const profileData = await profileRes.json();
  console.log("User Profile:", {
    name: profileData.data.user.name,
    points: profileData.data.user.points,
    rank: profileData.data.user.rank.title,
    badge: profileData.data.user.rank.badge,
    lessonsCompleted: profileData.data.stats.lessonsCompleted,
    quizzesPassed: profileData.data.stats.quizzesPassed,
    historyEntries: profileData.data.history.length,
  });

  if (profileData.data.user.points !== 40) {
    throw new Error(`Expected total points to be 40 (10 from lesson + 30 from quiz), got: ${profileData.data.user.points}`);
  }

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("Assessment Engine, Zero-Cheat Protection, Backend Grading, Points System, and Profile verified!");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
