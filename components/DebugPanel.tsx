"use client";

import { useState } from "react";

interface Props {
  events: string[];
}

/**
 * On-screen recognizer log, shown only when the URL carries `?debug`. Exists so
 * a phone (where DevTools isn't reachable) can surface what the speech engine is
 * actually doing — the "Copy" button hands the whole log off for a bug report.
 */
export default function DebugPanel({ events }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(events.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-lime-400 bg-black/90 text-lime-300">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-xs font-bold tracking-wide text-lime-400">
          🐛 speech debug
        </span>
        <span className="text-[10px] text-lime-500/70">{events.length} events</span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded bg-lime-400 px-2 py-0.5 text-xs font-semibold text-black"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-lime-500/60 px-2 py-0.5 text-xs font-semibold"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {open && (
        <pre className="max-h-48 overflow-y-auto px-3 pb-2 font-mono text-[11px] leading-tight whitespace-pre-wrap">
          {events.length ? events.join("\n") : "(no events yet — tap a record button)"}
        </pre>
      )}
    </div>
  );
}
