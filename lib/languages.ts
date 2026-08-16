export type LangCode = "en" | "yue" | "zh" | "ja" | "es" | "fr";

export interface Language {
  code: LangCode;
  /** English name, used in the UI chrome */
  label: string;
  /** Endonym, shown on the big buttons */
  native: string;
  /** BCP-47 tag handed to the browser's SpeechRecognition */
  speech: string;
  /** Preferred TTS voice locales, most specific first */
  tts: string[];
  /** How the language is described to the translation model */
  prompt: string;
  flag: string;
}

export const LANGUAGES: Language[] = [
  {
    code: "en",
    label: "English",
    native: "English",
    speech: "en-US",
    tts: ["en-US", "en-GB"],
    prompt: "English",
    flag: "🇬🇧",
  },
  {
    code: "yue",
    label: "Cantonese",
    native: "廣東話",
    speech: "zh-HK",
    tts: ["zh-HK", "yue-Hant-HK", "zh-TW"],
    prompt:
      "Cantonese — spoken Hong Kong Cantonese written in Traditional Chinese characters " +
      "(use colloquial forms such as 係, 唔, 嘅, 咗, 喺, 咩), NOT Mandarin and NOT Standard Written Chinese",
    flag: "🇭🇰",
  },
  {
    code: "zh",
    label: "Mandarin",
    native: "普通话",
    speech: "zh-CN",
    tts: ["zh-CN"],
    prompt:
      "Mandarin Chinese written in Simplified Chinese characters (Standard Written Chinese, " +
      "Putonghua), NOT Cantonese and NOT spoken Cantonese colloquialisms",
    flag: "🇨🇳",
  },
  {
    code: "ja",
    label: "Japanese",
    native: "日本語",
    speech: "ja-JP",
    tts: ["ja-JP"],
    prompt: "Japanese",
    flag: "🇯🇵",
  },
  {
    code: "es",
    label: "Spanish",
    native: "Español",
    speech: "es-ES",
    tts: ["es-ES", "es-419", "es-MX"],
    prompt: "Spanish",
    flag: "🇪🇸",
  },
  {
    code: "fr",
    label: "French",
    native: "Français",
    speech: "fr-FR",
    tts: ["fr-FR", "fr-CA"],
    prompt: "French",
    flag: "🇫🇷",
  },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: LangCode): Language {
  const lang = BY_CODE.get(code);
  if (!lang) throw new Error(`Unknown language: ${code}`);
  return lang;
}

export function isLangCode(value: unknown): value is LangCode {
  return typeof value === "string" && BY_CODE.has(value as LangCode);
}

export type Side = "A" | "B";
