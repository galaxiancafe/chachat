"use client";

import { useEffect, useRef } from "react";
import {
  SIDE_STYLE,
  VIEW_BACKGROUND,
  type Message,
  type ViewMode,
} from "@/lib/conversation";
import type { Language, Side } from "@/lib/languages";
import MessageBubble from "./MessageBubble";
import { MicIcon, StopIcon } from "./icons";

const ENGINE_LABEL: Record<string, string> = {
  claude: "Claude",
  google: "Google",
  mymemory: "MyMemory",
};

interface Props {
  langs: Record<Side, Language>;
  messages: Message[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  listeningSide: Side | null;
  interim: string;
  error: string | null;
  /** Which translation backend answered, once we've heard from one */
  engine: string | null;
  onRecord: (side: Side) => void;
  onRetry: (id: string) => void;
  onEnd: () => void;
}

function RecordButton({
  side,
  lang,
  listening,
  disabled,
  interim,
  onClick,
}: {
  side: Side;
  lang: Language;
  listening: boolean;
  disabled: boolean;
  interim: string;
  onClick: () => void;
}) {
  const style = SIDE_STYLE[side];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={listening}
      className={`flex min-h-28 flex-1 flex-col items-center justify-center gap-1.5 rounded-3xl px-3 py-4 font-semibold shadow-lg transition disabled:opacity-30 ${
        listening ? style.buttonListening : style.button
      }`}
    >
      {listening ? <StopIcon /> : <MicIcon />}
      <span className="text-lg leading-none">{lang.native}</span>
      <span className="max-w-full truncate px-1 text-xs font-normal opacity-80">
        {listening
          ? interim || "Listening… tap to stop"
          : `Speaker ${side} · tap to speak`}
      </span>
    </button>
  );
}

export default function ChatScreen({
  langs,
  messages,
  viewMode,
  setViewMode,
  listeningSide,
  interim,
  error,
  engine,
  onRecord,
  onRetry,
  onEnd,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, listeningSide]);

  const viewOptions: { mode: ViewMode; label: string }[] = [
    { mode: "both", label: "Both" },
    { mode: "A", label: langs.A.native },
    { mode: "B", label: langs.B.native },
  ];

  return (
    <div
      className={`flex h-dvh flex-col transition-colors duration-300 ${VIEW_BACKGROUND[viewMode]}`}
    >
      <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div className="flex flex-1 items-center gap-2 text-sm font-semibold">
          <span className={`rounded-full px-2.5 py-1 ${SIDE_STYLE.A.chip}`}>
            {langs.A.native}
          </span>
          <span className="text-slate-400">⇄</span>
          <span className={`rounded-full px-2.5 py-1 ${SIDE_STYLE.B.chip}`}>
            {langs.B.native}
          </span>
          {engine && (
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
              via {ENGINE_LABEL[engine] ?? engine}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
        >
          End
        </button>
      </header>

      <div className="flex gap-1 px-4 py-2">
        {viewOptions.map(({ mode, label }) => {
          const active = viewMode === mode;
          const activeStyle =
            mode === "both"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : SIDE_STYLE[mode as Side].chip;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              aria-pressed={active}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                active
                  ? activeStyle
                  : "text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Tap the button on your side and start talking.
            <br />
            Tap it again when you finish.
          </p>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            viewMode={viewMode}
            langs={langs}
            onRetry={onRetry}
          />
        ))}
        <div ref={bottomRef} />
      </main>

      {error && (
        <p className="mx-4 mb-2 rounded-xl bg-red-100 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <footer className="flex gap-3 border-t border-black/5 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10">
        <RecordButton
          side="A"
          lang={langs.A}
          listening={listeningSide === "A"}
          disabled={listeningSide === "B"}
          interim={interim}
          onClick={() => onRecord("A")}
        />
        <RecordButton
          side="B"
          lang={langs.B}
          listening={listeningSide === "B"}
          disabled={listeningSide === "A"}
          interim={interim}
          onClick={() => onRecord("B")}
        />
      </footer>
    </div>
  );
}
