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

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
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

// Errors after which retrying is pointless — stop the keep-alive loop.
const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "language-not-supported",
]);

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
 * `start` until `stop`, and the accumulated transcript is handed to
 * `onUtterance` as a single utterance.
 *
 * The wrinkle this handles: Android Chrome ends recognition after every pause
 * (it ignores `continuous`), which on a phone looks like "the mic doesn't
 * work." So while the user still wants to be heard, we transparently restart
 * the recognizer on each `onend` and keep appending to one transcript. Desktop
 * keeps `continuous = true` and rarely needs the restart, but it's harmless
 * there too.
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
  const langRef = useRef("");
  // True from `start` until the user (or a fatal error) stops the session.
  const wantRef = useRef(false);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const clearRestart = () => {
    if (restartRef.current) {
      clearTimeout(restartRef.current);
      restartRef.current = null;
    }
  };

  const finalize = useCallback(() => {
    const text = finalRef.current.trim();
    const side = sideRef.current;
    finalRef.current = "";
    sideRef.current = null;
    recRef.current = null;
    wantRef.current = false;
    clearRestart();
    setListeningSide(null);
    setInterim("");
    if (text && side) onUtteranceRef.current(side, text);
  }, []);

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      wantRef.current = false;
      clearRestart();
      recRef.current?.abort();
    };
  }, []);

  const stop = useCallback(() => {
    // Signal intent first so the pending `onend` finalizes instead of restarting.
    wantRef.current = false;
    clearRestart();
    try {
      recRef.current?.stop();
    } catch {
      finalize();
    }
  }, [finalize]);

  const start = useCallback(
    (side: Side, speechLang: string) => {
      const Ctor = getCtor();
      if (!Ctor) {
        setSupported(false);
        return;
      }
      // Tear down any prior session without emitting it.
      wantRef.current = false;
      clearRestart();
      recRef.current?.abort();

      finalRef.current = "";
      sideRef.current = side;
      langRef.current = speechLang;
      wantRef.current = true;

      const mobile = isMobile();

      const build = (): SpeechRecognitionLike => {
        const rec = new Ctor();
        rec.lang = langRef.current;
        // Android ignores `continuous` and stops after each phrase, so on mobile
        // we lean on the restart loop instead of fighting it.
        rec.continuous = !mobile;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

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
          // `aborted` is our own teardown; `no-speech` just means silence — let
          // the keep-alive loop carry on. Fatal errors stop it and surface.
          if (event.error === "aborted" || event.error === "no-speech") return;
          if (FATAL_ERRORS.has(event.error)) wantRef.current = false;
          setError(
            ERROR_MESSAGES[event.error] ??
              `Speech recognition failed (${event.error}).`
          );
        };

        rec.onend = () => {
          setInterim("");
          if (!wantRef.current) {
            finalize();
            return;
          }
          // Still listening: the phone ended the phrase, so start a fresh
          // recognizer and keep the same running transcript.
          restartRef.current = setTimeout(() => {
            if (!wantRef.current) {
              finalize();
              return;
            }
            try {
              recRef.current = build();
              recRef.current.start();
            } catch {
              finalize();
            }
          }, 150);
        };

        return rec;
      };

      setError(null);
      setInterim("");
      setListeningSide(side);

      try {
        recRef.current = build();
        recRef.current.start();
      } catch {
        recRef.current = null;
        wantRef.current = false;
        setListeningSide(null);
        setError("Could not start the microphone. Try again.");
      }
    },
    [finalize]
  );

  const clearError = useCallback(() => setError(null), []);

  return { supported, listeningSide, interim, error, start, stop, clearError };
}
