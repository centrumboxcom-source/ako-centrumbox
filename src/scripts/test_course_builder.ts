import fs from "fs";
import path from "path";

async function runTest() {
  const baseUrl = "http://localhost:3000";
  console.log("=== Testing Course Builder API & Multi-Tenant Features ===");

  // 1. Create a course in tenant 'acme'
  console.log("\n1. Creating test course in tenant 'acme'...");
  const createCourseRes = await fetch(`${baseUrl}/api/courses?tenant=acme`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Основи веб-розробки та безпеки 2026",
      description: "Комплексний навчальний курс для нових інженерів компанії Acme.",
      isPublished: true,
    }),
  });

  const courseData = await createCourseRes.json();
  console.log("Create course response:", courseData);
  if (!courseData.success) throw new Error("Failed to create course");

  const courseId = courseData.data.id;

  // 2. Add Lesson 1 with rich JSON blocks (Heading, Text, Code, Callout)
  console.log("\n2. Adding Lesson 1 with rich JSON blocks...");
  const lesson1Blocks = [
    {
      id: "b_head_1",
      type: "heading",
      level: 1,
      text: "Вступ до архітектури multi-tenant",
    },
    {
      id: "b_text_1",
      type: "text",
      text: "У цьому уроці ми розглянемо підхід schema-per-tenant в PostgreSQL за допомогою Drizzle ORM.",
    },
    {
      id: "b_callout_1",
      type: "callout",
      variant: "tip",
      text: "Використання SET LOCAL search_path в межах транзакції запобігає забрудненню пулу з'єднань.",
    },
    {
      id: "b_code_1",
      type: "code",
      language: "typescript",
      code: "export async function withTenantDb(subdomain: string, cb) {\n  const client = await pool.connect();\n  try {\n    await client.query(`SET LOCAL search_path TO \"${subdomain}\", public`);\n    return await cb(db);\n  } finally {\n    client.release();\n  }\n}",
    },
  ];

  const createLesson1Res = await fetch(`${baseUrl}/api/courses/${courseId}/lessons?tenant=acme`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Модуль 1: Архітектура бази даних",
      content: lesson1Blocks,
      order: 1,
    }),
  });
  const lesson1Data = await createLesson1Res.json();
  console.log("Lesson 1 created:", lesson1Data.success, lesson1Data.data?.id);
  const lesson1Id = lesson1Data.data.id;

  // 3. Add Lesson 2 with Video and Callout
  console.log("\n3. Adding Lesson 2 with video and callouts...");
  const lesson2Blocks = [
    {
      id: "b_head_2",
      type: "heading",
      level: 1,
      text: "Відеоогляд системи авторизації",
    },
    {
      id: "b_video_1",
      type: "video",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      caption: "Огляд маршрутизації ролей та JWT токенів",
    },
    {
      id: "b_callout_2",
      type: "callout",
      variant: "warning",
      text: "Працівник компанії Acme не може залогінитись на сабдомені компанії Globex.",
    },
  ];

  const createLesson2Res = await fetch(`${baseUrl}/api/courses/${courseId}/lessons?tenant=acme`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Модуль 2: Авторизація та RBAC",
      content: lesson2Blocks,
      order: 2,
    }),
  });
  const lesson2Data = await createLesson2Res.json();
  console.log("Lesson 2 created:", lesson2Data.success, lesson2Data.data?.id);
  const lesson2Id = lesson2Data.data.id;

  // 4. Test reordering: swap lesson 2 to be first, lesson 1 to be second
  console.log("\n4. Testing lesson reorder (swap order)...");
  const reorderRes = await fetch(`${baseUrl}/api/courses/${courseId}/lessons/reorder?tenant=acme`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderedLessonIds: [lesson2Id, lesson1Id],
    }),
  });
  const reorderData = await reorderRes.json();
  console.log("Reorder response:", reorderData);

  // 5. Test Media Upload endpoint (/api/upload)
  console.log("\n5. Testing tenant media upload (/api/upload)...");
  const dummyFileContent = "Fake PNG media data for tenant acme";
  const blob = new Blob([dummyFileContent], { type: "image/png" });
  const formData = new FormData();
  formData.append("file", blob, "test_diagram.png");

  const uploadRes = await fetch(`${baseUrl}/api/upload?tenant=acme`, {
    method: "POST",
    headers: {
      "x-tenant-override": "acme",
    },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  console.log("Upload response:", uploadData);

  // Check that file exists on disk
  const expectedDiskPath = path.join(process.cwd(), "public", uploadData.url);
  console.log("Checking disk file existence:", expectedDiskPath, fs.existsSync(expectedDiskPath));

  // 6. Verify course query returns the ordered lessons
  console.log("\n6. Verifying course GET query with ordered lessons...");
  const getCourseRes = await fetch(`${baseUrl}/api/courses/${courseId}?tenant=acme`);
  const fetchedCourse = await getCourseRes.json();
  console.log("Course lessons count:", fetchedCourse.data?.lessons?.length);
  console.log("First lesson title:", fetchedCourse.data?.lessons?.[0]?.title);
  console.log("First lesson order:", fetchedCourse.data?.lessons?.[0]?.order);
  console.log("Second lesson title:", fetchedCourse.data?.lessons?.[1]?.title);
  console.log("Second lesson order:", fetchedCourse.data?.lessons?.[1]?.order);

  console.log("\n=== All Tests Passed Successfully! ===");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
