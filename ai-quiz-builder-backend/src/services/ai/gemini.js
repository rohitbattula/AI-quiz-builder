import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw Object.assign(new Error("GOOGLE_API_KEY not configured"), {
        status: 500,
      });
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

const SYSTEM = `
You generate multiple-choice quiz questions based on the quiz metadata and, if provided, the source text.
 Return STRICT JSON ONLY. No markdown, no commentary.
 Schema:
 {
   "questions": [
     {
       "text": "string",
       "options": ["string", "string", "string", "string"],
       "correctIndex": 0,
       "points": 1
     }
   ]
 }
 Rules:
 - Exactly 4 options per question.
 - Exactly one correctIndex (0..3).
 - Clear, unambiguous wording. Avoid trick questions.
`;

export async function generateQuestions({
  topic,
  title,
  difficulty,
  numQuestions,
  sourceText,
}) {
  const client = getGenAI();

  const hasSource = !!(sourceText && sourceText.trim().length);
  const prompt = [
    SYSTEM.trim(),
    `Title: ${title || "(none)"}`,
    `Topic: ${topic || "(none)"}`,
    `Difficulty: ${difficulty || "medium"}`,
    `Target number of questions: ${numQuestions || 10}`,
    hasSource
      ? `Source text (use only this knowledge):\n${sourceText}`
      : `No external source text is provided. Base questions on the topic/title above and widely taught fundamentals.`,
    `Return strictly valid JSON following the schema.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s >= 0 && e > s) parsed = JSON.parse(raw.slice(s, e + 1));
    else
      throw Object.assign(new Error("AI did not return valid JSON"), {
        status: 502,
      });
  }

  return { prompt, json: parsed };
}

export function validateAndShapeQuestions(json, targetCount = 10) {
  const out = [];
  const arr = Array.isArray(json?.questions) ? json.questions : [];
  for (const q of arr) {
    const text = (q?.text ?? "").toString().trim();
    const options = Array.isArray(q?.options)
      ? q.options.map((o) => (o ?? "").toString())
      : [];
    let correctIndex = Number.isInteger(q?.correctIndex) ? q.correctIndex : 0;
    let points = Number.isFinite(q?.points) ? Number(q.points) : 1;

    if (!text) continue;
    if (options.length !== 4) continue;
    if (correctIndex < 0 || correctIndex > 3) continue;
    if (points <= 0) points = 1;

    out.push({ text, options: options.slice(0, 4), correctIndex, points });

    if (out.length >= targetCount) break;
  }
  if (!out.length) {
    throw Object.assign(new Error("No valid questions produced by AI"), {
      status: 502,
    });
  }
  return out;
}
