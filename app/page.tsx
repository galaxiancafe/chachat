"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import ChatScreen from "@/components/ChatScreen";
import SetupScreen from "@/components/SetupScreen";
import {
  OTHER,
  VIEW_BACKGROUND,
  type Message,
  type ViewMode,
} from "@/lib/conversation";
import { getLanguage, type Language, type LangCode, type Side } from "@/lib/languages";
import { useSpeech } from "@/lib/useSpeech";

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function Home() {
  const [phase, setPhase] = useState<"setup" | "chat">("setup");
  const [codes, setCodes] = useState<Record<Side, LangCode>>({
    A: "en",
    B: "yue",
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [engine, setEngine] = useState<string | null>(null);

  const langs = useMemo<Record<Side, Language>>(
    () => ({ A: getLanguage(codes.A), B: getLanguage(codes.B) }),
    [codes]
  );

  // Callbacks below outlive individual renders, so read the live values via a ref.
  const langsRef = useRef(langs);
  langsRef.current = langs;

  const translate = useCallback(
    async (id: string, text: string, side: Side) => {
      const from = langsRef.current[side];
      const to = langsRef.current[OTHER[side]];
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, from: from.code, to: to.code }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Translation failed.");

        if (typeof data.provider === "string") setEngine(data.provider);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, translation: data.translation as string, status: "done" }
              : m
          )
        );
      } catch (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Translation failed.",
                }
              : m
          )
        );
      }
    },
    []
  );

  const handleUtterance = useCallback(
    (side: Side, text: string) => {
      const id = newId();
      setMessages((prev) => [
        ...prev,
        { id, side, original: text, translation: null, status: "translating" },
      ]);
      void translate(id, text, side);
    },
    [translate]
  );

  const speech = useSpeech(handleUtterance);

  const handleRecord = useCallback(
    (side: Side) => {
      if (speech.listeningSide === side) {
        speech.stop();
        return;
      }
      speech.start(side, langsRef.current[side].speech);
    },
    [speech]
  );

  const handleRetry = useCallback(
    (id: string) => {
      const message = messages.find((m) => m.id === id);
      if (!message) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "translating", error: undefined } : m
        )
      );
      void translate(id, message.original, message.side);
    },
    [messages, translate]
  );

  const handlePick = useCallback((side: Side, code: LangCode) => {
    setCodes((prev) => {
      const other = OTHER[side];
      // Picking the language the other side already holds swaps them instead of
      // leaving both speakers on the same language.
      if (prev[other] === code) return { ...prev, [side]: code, [other]: prev[side] };
      return { ...prev, [side]: code };
    });
  }, []);

  const handleSwap = useCallback(() => {
    setCodes((prev) => ({ A: prev.B, B: prev.A }));
  }, []);

  const handleStart = useCallback(() => {
    setMessages([]);
    setViewMode("both");
    setPhase("chat");
  }, []);

  const handleEnd = useCallback(() => {
    speech.stop();
    setPhase("setup");
  }, [speech]);

  if (phase === "setup") {
    return (
      <div className={`flex min-h-dvh flex-col ${VIEW_BACKGROUND.both}`}>
        <SetupScreen
          langA={codes.A}
          langB={codes.B}
          onPick={handlePick}
          onSwap={handleSwap}
          onStart={handleStart}
          speechSupported={speech.supported}
        />
      </div>
    );
  }

  return (
    <ChatScreen
      langs={langs}
      messages={messages}
      viewMode={viewMode}
      setViewMode={setViewMode}
      listeningSide={speech.listeningSide}
      interim={speech.interim}
      error={speech.error}
      engine={engine}
      onRecord={handleRecord}
      onRetry={handleRetry}
      onEnd={handleEnd}
    />
  );
}
