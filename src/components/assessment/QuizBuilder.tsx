"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Award,
  Layers,
  FileQuestion,
  ToggleLeft,
  CheckSquare,
  CircleDot,
  Loader2,
} from "lucide-react";

export interface QuizOptionInput {
  id?: string;
  optionText: string;
  isCorrect: boolean;
  order: number;
}

export interface QuizQuestionInput {
  id?: string;
  questionText: string;
  questionType: "single" | "multiple";
  explanation?: string | null;
  points: number;
  order: number;
  options: QuizOptionInput[];
}

export interface QuizDataInput {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  passingScore: number;
  rewardPoints: number;
  questions: QuizQuestionInput[];
}

interface QuizBuilderProps {
  initialData: QuizDataInput;
  tenantSubdomain: string;
  onSaved?: (updated: QuizDataInput) => void;
}

export function QuizBuilder({ initialData, tenantSubdomain, onSaved }: QuizBuilderProps) {
  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description || "");
  const [passingScore, setPassingScore] = useState(initialData.passingScore || 70);
  const [rewardPoints, setRewardPoints] = useState(initialData.rewardPoints || 25);
  const [questions, setQuestions] = useState<QuizQuestionInput[]>(initialData.questions || []);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add question
  const addQuestion = (type: "single" | "multiple" = "single") => {
    const newQ: QuizQuestionInput = {
      questionText: "Нове запитання...",
      questionType: type,
      points: 1,
      order: questions.length + 1,
      explanation: "Пояснення правильної відповіді...",
      options: [
        { optionText: "Варіант А (правильний)", isCorrect: true, order: 1 },
        { optionText: "Варіант Б", isCorrect: false, order: 2 },
      ],
    };
    setQuestions([...questions, newQ]);
  };

  // Delete question
  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, idx) => idx !== index));
  };

  // Move question
  const moveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setQuestions(reordered.map((q, i) => ({ ...q, order: i + 1 })));
  };

  // Add option to question
  const addOption = (qIndex: number) => {
    const updated = [...questions];
    const q = updated[qIndex];
    q.options.push({
      optionText: `Новий варіант ${q.options.length + 1}`,
      isCorrect: false,
      order: q.options.length + 1,
    });
    setQuestions(updated);
  };

  // Delete option from question
  const deleteOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    const q = updated[qIndex];
    if (q.options.length <= 2) {
      alert("Питання повинно мати щонайменше 2 варіанти відповіді");
      return;
    }
    q.options.splice(optIndex, 1);
    setQuestions(updated);
  };

  // Toggle option correctness
  const toggleOptionCorrectness = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    const q = updated[qIndex];

    if (q.questionType === "single") {
      // Set only this option to true
      q.options.forEach((opt, idx) => {
        opt.isCorrect = idx === optIndex;
      });
    } else {
      // Toggle checkbox
      q.options[optIndex].isCorrect = !q.options[optIndex].isCorrect;
    }
    setQuestions(updated);
  };

  // Switch question type
  const switchQuestionType = (qIndex: number, newType: "single" | "multiple") => {
    const updated = [...questions];
    const q = updated[qIndex];
    q.questionType = newType;
    if (newType === "single") {
      // Ensure only 1 is true
      let foundOne = false;
      q.options.forEach((opt) => {
        if (opt.isCorrect && !foundOne) {
          foundOne = true;
        } else {
          opt.isCorrect = false;
        }
      });
      if (!foundOne && q.options.length > 0) {
        q.options[0].isCorrect = true;
      }
    }
    setQuestions(updated);
  };

  // Save Quiz
  const handleSaveQuiz = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    // Validate
    if (!title.trim()) {
      setErrorMessage("Вкажіть назву тесту");
      setSaving(false);
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setErrorMessage(`Запитання #${i + 1} не має тексту`);
        setSaving(false);
        return;
      }
      const hasCorrect = q.options.some((o) => o.isCorrect);
      if (!hasCorrect) {
        setErrorMessage(`У запитанні #${i + 1} не позначено жодної правильної відповіді`);
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch(
        `/api/quizzes/${initialData.id}?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-override": tenantSubdomain,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            passingScore,
            rewardPoints,
            questions,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося зберегти тест");
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);

      if (onSaved) {
        onSaved({
          ...initialData,
          title,
          description,
          passingScore,
          rewardPoints,
          questions,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Конструктор тестів (Assessment Engine)
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Налаштування тестування
            </h1>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveQuiz}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 shrink-0"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Збереження...
              </>
            ) : savedSuccess ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                Збережено!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Зберегти тест
              </>
            )}
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* General Settings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-12">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Назва тесту *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Наприклад: Підсумкове тестування з кібергігієни"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-12">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Опис тесту або інструкція
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Короткі правила проходження (час, спроби, критерії)..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Прохідний бал (%)</span>
              <span className="text-emerald-400 font-mono font-bold">{passingScore}%</span>
            </label>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-amber-400" />
              <span>Бали за успішне складання (Gamification Points)</span>
            </label>
            <input
              type="number"
              min={0}
              max={500}
              value={rewardPoints}
              onChange={(e) => setRewardPoints(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold font-mono text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-indigo-400" />
            Запитання тесту ({questions.length})
          </h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => addQuestion("single")}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
            >
              <CircleDot className="h-3.5 w-3.5 text-indigo-400" />
              + Одна відповідь
            </button>
            <button
              type="button"
              onClick={() => addQuestion("multiple")}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
            >
              <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
              + Кілька відповідей
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
            <FileQuestion className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">У тесті ще немає запитань</h3>
            <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
              Додайте запитання з однією правильною відповіддю або з можливістю обрати кілька варіантів.
            </p>
            <button
              type="button"
              onClick={() => addQuestion("single")}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20"
            >
              + Додати перше запитання
            </button>
          </div>
        ) : (
          questions.map((q, qIdx) => (
            <div
              key={qIdx}
              className="rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl overflow-hidden"
            >
              {/* Question Card Header */}
              <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold font-mono flex items-center justify-center">
                    {qIdx + 1}
                  </span>

                  {/* Type Selector Toggle */}
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => switchQuestionType(qIdx, "single")}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                        q.questionType === "single"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Одна відповідь
                    </button>
                    <button
                      type="button"
                      onClick={() => switchQuestionType(qIdx, "multiple")}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                        q.questionType === "multiple"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Кілька відповідей
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    ({q.points || 1} {q.points === 1 ? "бал" : "бали"})
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={qIdx === 0}
                    onClick={() => moveQuestion(qIdx, "up")}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 transition"
                    title="Підняти вище"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={qIdx === questions.length - 1}
                    onClick={() => moveQuestion(qIdx, "down")}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 transition"
                    title="Опустити нижче"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(qIdx)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition ml-1"
                    title="Видалити запитання"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Question Body */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Текст запитання:
                  </label>
                  <input
                    type="text"
                    value={q.questionText}
                    onChange={(e) => {
                      const updated = [...questions];
                      updated[qIdx].questionText = e.target.value;
                      setQuestions(updated);
                    }}
                    placeholder="Введіть запитання..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Options List */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400">
                    Варіанти відповідей (відмітьте правильну/і):
                  </label>

                  {q.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border transition ${
                        opt.isCorrect
                          ? "bg-emerald-950/30 border-emerald-600/70"
                          : "bg-slate-950/60 border-slate-800/80"
                      }`}
                    >
                      {/* Checkbox / Radio toggle for correctness */}
                      <button
                        type="button"
                        onClick={() => toggleOptionCorrectness(qIdx, optIdx)}
                        className={`h-5 w-5 rounded-md flex items-center justify-center transition shrink-0 ${
                          opt.isCorrect
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-700 hover:border-slate-500 text-transparent"
                        }`}
                        title={opt.isCorrect ? "Правильна відповідь" : "Позначити як правильну"}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>

                      <input
                        type="text"
                        value={opt.optionText}
                        onChange={(e) => {
                          const updated = [...questions];
                          updated[qIdx].options[optIdx].optionText = e.target.value;
                          setQuestions(updated);
                        }}
                        placeholder={`Варіант ${optIdx + 1}...`}
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => deleteOption(qIdx, optIdx)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Видалити варіант"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addOption(qIdx)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 pt-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Додати ще варіант
                  </button>
                </div>

                {/* Explanation */}
                <div className="pt-2 border-t border-slate-800/70">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Пояснення до відповіді (буде показано студенту після здачі тесту):
                  </label>
                  <input
                    type="text"
                    value={q.explanation || ""}
                    onChange={(e) => {
                      const updated = [...questions];
                      updated[qIdx].explanation = e.target.value;
                      setQuestions(updated);
                    }}
                    placeholder="Чому ця відповідь правильна або посилання на розділ лекції..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
