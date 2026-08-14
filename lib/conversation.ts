import type { Side } from "./languages";

export interface Message {
  id: string;
  side: Side;
  /** What the speaker actually said, in their own language */
  original: string;
  /** The other side's language; null while in flight or on failure */
  translation: string | null;
  status: "translating" | "done" | "error";
  error?: string;
}

/** "both" shows the spoken text first; "A"/"B" pins one language to the top. */
export type ViewMode = "both" | Side;

/** The rendering of a message in a given side's language, if we have it yet. */
export function textFor(message: Message, side: Side): string | null {
  return side === message.side ? message.original : message.translation;
}

export const OTHER: Record<Side, Side> = { A: "B", B: "A" };

export const SIDE_STYLE: Record<
  Side,
  {
    bubble: string;
    secondaryText: string;
    divider: string;
    button: string;
    buttonListening: string;
    chip: string;
    ring: string;
  }
> = {
  A: {
    bubble: "bg-sky-600 text-white",
    secondaryText: "text-sky-100",
    divider: "border-sky-400/40",
    button: "bg-sky-600 text-white hover:bg-sky-500 active:bg-sky-700",
    buttonListening: "bg-sky-700 text-white ring-4 ring-sky-300",
    chip: "bg-sky-600 text-white",
    ring: "ring-sky-400",
  },
  B: {
    bubble: "bg-amber-400 text-amber-950",
    secondaryText: "text-amber-900",
    divider: "border-amber-700/30",
    button:
      "bg-amber-400 text-amber-950 hover:bg-amber-300 active:bg-amber-500",
    buttonListening: "bg-amber-500 text-amber-950 ring-4 ring-amber-200",
    chip: "bg-amber-400 text-amber-950",
    ring: "ring-amber-400",
  },
};

export const VIEW_BACKGROUND: Record<ViewMode, string> = {
  both: "bg-slate-100 dark:bg-slate-950",
  A: "bg-sky-50 dark:bg-sky-950",
  B: "bg-amber-50 dark:bg-amber-950",
};
