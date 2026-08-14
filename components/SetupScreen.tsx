"use client";

import { LANGUAGES, getLanguage, type LangCode, type Side } from "@/lib/languages";
import { SIDE_STYLE } from "@/lib/conversation";
import { SwapIcon } from "./icons";

interface Props {
  langA: LangCode;
  langB: LangCode;
  onPick: (side: Side, code: LangCode) => void;
  onSwap: () => void;
  onStart: () => void;
  speechSupported: boolean | null;
}

function LanguagePicker({
  side,
  selected,
  onPick,
}: {
  side: Side;
  selected: LangCode;
  onPick: (code: LangCode) => void;
}) {
  const style = SIDE_STYLE[side];
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${style.chip}`}
        >
          {side}
        </span>
        Speaker {side} speaks
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {LANGUAGES.map((lang) => {
          const active = lang.code === selected;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onPick(lang.code)}
              aria-pressed={active}
              className={`rounded-2xl border-2 px-4 py-4 text-left transition ${
                active
                  ? `${style.button} border-transparent shadow-lg`
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
              }`}
            >
              <div className="text-xl leading-tight font-semibold">
                {lang.flag} {lang.native}
              </div>
              <div className="mt-0.5 text-xs opacity-70">{lang.label}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function SetupScreen({
  langA,
  langB,
  onPick,
  onSwap,
  onStart,
  speechSupported,
}: Props) {
  const sameLanguage = langA === langB;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">
          🍵 ChaChat
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          Two cups, two tongues.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          One phone, two people, two languages. Pick a primary language for each
          speaker — mixing in other languages mid-sentence is fine.
        </p>
      </header>

      <LanguagePicker side="A" selected={langA} onPick={(c) => onPick("A", c)} />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onSwap}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <SwapIcon />
          Swap
        </button>
      </div>

      <LanguagePicker side="B" selected={langB} onPick={(c) => onPick("B", c)} />

      <div className="mt-auto space-y-3 pt-4">
        {speechSupported === false && (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            This browser has no speech recognition. Use Chrome or Edge on
            desktop/Android, or Safari on iOS.
          </p>
        )}
        <button
          type="button"
          onClick={onStart}
          disabled={sameLanguage}
          className="w-full rounded-2xl bg-slate-900 px-6 py-5 text-lg font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {sameLanguage
            ? "Pick two different languages"
            : `Start · ${getLanguage(langA).native} ⇄ ${getLanguage(langB).native}`}
        </button>
      </div>
    </div>
  );
}
