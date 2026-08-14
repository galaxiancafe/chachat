import Anthropic from "@anthropic-ai/sdk";
import { getLanguage, type LangCode } from "./languages";

/**
 * Translation backends, server-side only. All three take the same shape so the
 * route (and the UI above it) never has to care which one is configured.
 */

export type ProviderName = "claude" | "google" | "mymemory";

export interface TranslateRequest {
  text: string;
  from: LangCode;
  to: LangCode;
}

export interface TranslateResult {
  translation: string;
  provider: ProviderName;
}

/** Codes each free service expects. Google and MyMemory both speak `yue`. */
const WEB_CODES: Record<LangCode, string> = {
  en: "en",
  yue: "yue",
  zh: "zh-CN",
  ja: "ja",
  es: "es",
  fr: "fr",
};

// Some free endpoints reject requests without a browser-ish User-Agent.
const UA =
  "Mozilla/5.0 (compatible; two-way-translator/1.0; +https://github.com/)";

function buildSystemPrompt(from: string, to: string) {
  return [
    "You are a live interpreter sitting between two people having a face-to-face conversation.",
    `The speaker's primary language is ${from}. The listener needs ${to}.`,
    "",
    "The text you receive comes from speech recognition, so expect missing punctuation, filler words, and occasional mis-hearings.",
    "",
    "Rules:",
    `1. Reply with ONLY the ${to} translation. No preamble, no quotes, no notes, no romanization, no alternatives.`,
    `2. Speakers code-switch freely. Translate the meaning of the WHOLE utterance into ${to}, including any part that was spoken in some other language. If a fragment is already in ${to}, keep it as-is where that reads naturally.`,
    "3. This is speech, not a document. Keep it conversational and match the speaker's register and politeness level.",
    "4. Preserve names, numbers, dates, prices, and units exactly.",
    "5. If the input is garbled or fragmentary, translate your best reading of it. Never refuse, never ask for clarification, never explain — the conversation has to keep moving.",
  ].join("\n");
}

async function translateWithClaude({
  text,
  from,
  to,
}: TranslateRequest): Promise<TranslateResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: process.env.TRANSLATE_MODEL ?? "claude-sonnet-5",
    max_tokens: 1024,
    system: buildSystemPrompt(getLanguage(from).prompt, getLanguage(to).prompt),
    messages: [{ role: "user", content: text }],
  });

  const translation = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!translation) throw new Error("The translator returned nothing.");
  return { translation, provider: "claude" };
}

/**
 * Google's undocumented `gtx` endpoint — free, keyless, and the only free
 * option that reliably returns colloquial Cantonese. Unofficial: no SLA, and
 * heavy use gets the IP rate-limited.
 */
async function translateWithGoogle({
  text,
  from,
  to,
}: TranslateRequest): Promise<TranslateResult> {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=${WEB_CODES[from]}&tl=${WEB_CODES[to]}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`Google translate returned ${response.status}.`);

  // Shape: [[[translated, original, ...], ...], ...] — one entry per sentence.
  const data = (await response.json()) as [[string, string][]] | unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Unexpected response from Google translate.");
  }
  const translation = (data[0] as [string, string][])
    .map((segment) => segment?.[0] ?? "")
    .join("")
    .trim();

  if (!translation) throw new Error("Google translate returned nothing.");
  return { translation, provider: "google" };
}

/**
 * MyMemory — documented and free, but capped at 5k chars/day anonymously
 * (50k with an email in `MYMEMORY_EMAIL`).
 */
async function translateWithMyMemory({
  text,
  from,
  to,
}: TranslateRequest): Promise<TranslateResult> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${WEB_CODES[from]}|${WEB_CODES[to]}`,
  });
  if (process.env.MYMEMORY_EMAIL) params.set("de", process.env.MYMEMORY_EMAIL);

  const response = await fetch(
    `https://api.mymemory.translated.net/get?${params}`,
    { headers: { "User-Agent": UA } }
  );
  if (!response.ok) throw new Error(`MyMemory returned ${response.status}.`);

  const data = (await response.json()) as {
    responseStatus?: number | string;
    responseDetails?: string;
    responseData?: { translatedText?: string };
  };

  if (Number(data.responseStatus) !== 200) {
    throw new Error(data.responseDetails || "MyMemory rejected the request.");
  }
  const translation = data.responseData?.translatedText?.trim();
  if (!translation) throw new Error("MyMemory returned nothing.");
  return { translation, provider: "mymemory" };
}

const PROVIDERS: Record<
  ProviderName,
  (request: TranslateRequest) => Promise<TranslateResult>
> = {
  claude: translateWithClaude,
  google: translateWithGoogle,
  mymemory: translateWithMyMemory,
};

function isProviderName(value: unknown): value is ProviderName {
  return value === "claude" || value === "google" || value === "mymemory";
}

/**
 * Explicit `TRANSLATE_PROVIDER` wins. Otherwise use Claude when a key exists
 * and fall back to the free engine so the app works with no configuration.
 */
export function resolveProvider(): ProviderName {
  const configured = process.env.TRANSLATE_PROVIDER;
  if (isProviderName(configured)) return configured;
  return process.env.ANTHROPIC_API_KEY ? "claude" : "google";
}

export async function translate(
  request: TranslateRequest
): Promise<TranslateResult> {
  const name = resolveProvider();
  if (name === "claude" && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("TRANSLATE_PROVIDER=claude but ANTHROPIC_API_KEY is not set.");
  }
  return PROVIDERS[name](request);
}
