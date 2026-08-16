"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Side } from "./languages";

/**
 * Minimal typings for the Web Speech API. It is a browser-native, prefixed API
 * that TypeScript's DOM lib still does not ship, so we describe only what we use.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed":
    "Microphone access was blocked. Allow the mic for this site and try again.",
  "service-not-allowed":
    "Microphone access was blocked. Allow the mic for this site and try again.",
  "audio-capture": "No microphone was found on this device.",
  network: "Speech recognition needs an internet connection.",
  "language-not-supported":
    "This browser has no speech model for that language. Chrome on desktop or Android has the widest coverage.",
};

export interface UseSpeech {
  /** null until mounted, then whether the browser exposes SpeechRecognition */
  supported: boolean | null;
  /** which side currently holds the mic, if any */
  listeningSide: Side | null;
  /** live, not-yet-final words for the active speaker */
  interim: string;
  error: string | null;
  start(side: Side, speechLang: string): void;
  stop(): void;
  clearError(): void;
}

/**
 * Wraps SpeechRecognition as a one-mic-at-a-time recorder. A session runs from
 * `start` until `stop` (or until the browser ends it on a long silence); the
 * accumulated final transcript is then handed to `onUtterance`.
 */
export function useSpeech(
  onUtterance: (side: Side, text: string) => void
): UseSpeech {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listeningSide, setListeningSide] = useState<Side | null>(null);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const sideRef = useRef<Side | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback((side: Side, speechLang: string) => {
    const Ctor = getCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    // Never let two sessions overlap: the previous mic is torn down silently.
    recRef.current?.abort();

    const rec = new Ctor();
    rec.lang = speechLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    finalRef.current = "";
    sideRef.current = side;

    rec.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalRef.current += text;
        else pending += text;
      }
      setInterim(pending);
    };

    rec.onerror = (event) => {
      // `aborted` is what we trigger ourselves on teardown; `no-speech` just
      // means the speaker stayed quiet. Neither is worth alarming anyone about.
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(
        ERROR_MESSAGES[event.error] ?? `Speech recognition failed (${event.error}).`
      );
    };

    rec.onend = () => {
      const text = finalRef.current.trim();
      const endedSide = sideRef.current;
      finalRef.current = "";
      sideRef.current = null;
      recRef.current = null;
      setListeningSide(null);
      setInterim("");
      if (text && endedSide) onUtteranceRef.current(endedSide, text);
    };

    recRef.current = rec;
    setError(null);
    setInterim("");
    setListeningSide(side);

    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListeningSide(null);
      setError("Could not start the microphone. Try again.");
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { supported, listeningSide, interim, error, start, stop, clearError };
}
