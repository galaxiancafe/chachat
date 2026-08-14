"use client";

import {
  OTHER,
  SIDE_STYLE,
  textFor,
  type Message,
  type ViewMode,
} from "@/lib/conversation";
import type { Language, Side } from "@/lib/languages";

interface Props {
  message: Message;
  viewMode: ViewMode;
  langs: Record<Side, Language>;
  onRetry: (id: string) => void;
}

export default function MessageBubble({
  message,
  viewMode,
  onRetry,
}: Props) {
  const style = SIDE_STYLE[message.side];
  const alignRight = message.side === "B";

  // In "both" mode the spoken words lead. In a focused view the chosen side's
  // language always leads, so one person can read straight down the thread.
  const topSide: Side = viewMode === "both" ? message.side : viewMode;
  const bottomSide = OTHER[topSide];

  const topText = textFor(message, topSide);
  const bottomText = textFor(message, bottomSide);

  return (
    <div className={`flex ${alignRight ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm ${style.bubble} ${
          alignRight ? "rounded-br-md" : "rounded-bl-md"
        }`}
      >
        <p className="text-lg leading-snug font-medium break-words whitespace-pre-wrap">
          {topText ?? <span className="opacity-60">…</span>}
        </p>

        <div className={`mt-2 border-t pt-2 ${style.divider}`}>
          {message.status === "translating" && bottomText === null ? (
            <p className={`text-sm italic ${style.secondaryText}`}>
              translating<span className="animate-pulse">…</span>
            </p>
          ) : message.status === "error" ? (
            <div className="flex items-center gap-2">
              <p className={`text-sm ${style.secondaryText}`}>
                {message.error ?? "Translation failed."}
              </p>
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="rounded-full bg-black/15 px-2.5 py-1 text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <p
              className={`text-sm leading-snug break-words whitespace-pre-wrap ${style.secondaryText}`}
            >
              {bottomText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
