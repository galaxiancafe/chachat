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

// Bounds on the keep-alive restart loop, so it can never spin forever if the
// device's speech engine ends instantly or never catches anything (e.g. a phone
// with no acoustic model for the chosen language).
const MAX_SESSION_MS = 30000; // hard cap on one tap-to-stop session
const MAX_IDLE_RESTARTS = 8; // consecutive restarts with no new words → give up

export interface UseSpeech {
  /** null until mounted, then whether the browser exposes SpeechRecognition */
  supported: boolean | null;
  /** which side currently holds the mic, if any */
  listeningSide: Side | null;
  /** live, not-yet-final words for the active speaker */
  interim: string;
  error: string | null;
  /** Rolling log of recognizer events, for the on-screen ?debug panel. */
  events: string[];
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
  const [events, setEvents] = useState<string[]>([]);

  const log = useCallback((msg: string) => {
    const stamp = new Date().toISOString().slice(11, 23);
    setEvents((prev) => [...prev.slice(-30), `${stamp}  ${msg}`]);
  }, []);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const sideRef = useRef<Side | null>(null);
  const langRef = useRef("");
  // True from `start` until the user (or a fatal error) stops the session.
  const wantRef = useRef(false);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef(0);
  const lastLenRef = useRef(0);
  const idleRestartsRef = useRef(0);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const clearTimers = () => {
    if (restartRef.current) {
      clearTimeout(restartRef.current);
      restartRef.current = null;
    }
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  };

  const finalize = useCallback(() => {
    const text = finalRef.current.trim();
    const side = sideRef.current;
    finalRef.current = "";
    sideRef.current = null;
    recRef.current = null;
    wantRef.current = false;
    clearTimers();
    setListeningSide(null);
    setInterim("");
    if (text && side) onUtteranceRef.current(side, text);
  }, []);

  useEffect(() => {
    const ok = getCtor() !== null;
    setSupported(ok);
    log(
      `init: SpeechRecognition=${ok} mobile=${isMobile()} ua=${
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 60) : "?"
      }`
    );
    return () => {
      wantRef.current = false;
      clearTimers();
      recRef.current?.abort();
    };
  }, [log]);

  const stop = useCallback(() => {
    // Signal intent first so the pending `onend` finalizes instead of restarting.
    wantRef.current = false;
    clearTimers();
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
      clearTimers();
      recRef.current?.abort();

      finalRef.current = "";
      sideRef.current = side;
      langRef.current = speechLang;
      wantRef.current = true;
      sessionStartRef.current = Date.now();
      lastLenRef.current = 0;
      idleRestartsRef.current = 0;

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
          if (finalRef.current) log(`result: "${finalRef.current.slice(-40)}"`);
        };

        rec.onerror = (event) => {
          log(`error: ${event.error}`);
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
            log("end: stopping (finalize)");
            finalize();
            return;
          }
          // Count restarts that gained no new words; reset when they do. This
          // catches an engine that ends instantly and would otherwise spin.
          if (finalRef.current.length > lastLenRef.current) {
            lastLenRef.current = finalRef.current.length;
            idleRestartsRef.current = 0;
          } else {
            idleRestartsRef.current += 1;
          }

          const timedOut = Date.now() - sessionStartRef.current > MAX_SESSION_MS;
          const spinning = idleRestartsRef.current >= MAX_IDLE_RESTARTS;
          if (timedOut || spinning) {
            log(`give up: ${timedOut ? "timeout" : "no-progress"} idle=${idleRestartsRef.current}`);
            wantRef.current = false;
            // Only nag if we never caught anything — otherwise just wrap up.
            if (finalRef.current.trim().length === 0) {
              setError(
                "Didn't catch any speech. Tap and speak again — check the mic is allowed and the selected language matches what you're speaking."
              );
            }
            finalize();
            return;
          }

          // Still listening: the phone ended the phrase, so start a fresh
          // recognizer and keep the same running transcript.
          log(`end: restart #${idleRestartsRef.current}`);
          restartRef.current = setTimeout(() => {
            if (!wantRef.current) {
              finalize();
              return;
            }
            try {
              recRef.current = build();
              recRef.current.start();
            } catch (e) {
              log(`restart threw: ${e instanceof Error ? e.name : "?"}`);
              finalize();
            }
          }, 150);
        };

        return rec;
      };

      setError(null);
      setInterim("");
      setListeningSide(side);
      log(`start: ${side} lang=${speechLang} continuous=${!mobile}`);
      // Absolute ceiling: even if `onend` never fires, end the session.
      sessionTimerRef.current = setTimeout(() => {
        if (wantRef.current) stop();
      }, MAX_SESSION_MS + 1000);

      try {
        recRef.current = build();
        recRef.current.start();
      } catch (e) {
        log(`start threw: ${e instanceof Error ? e.name : "?"}`);
        recRef.current = null;
        wantRef.current = false;
        setListeningSide(null);
        setError("Could not start the microphone. Try again.");
      }
    },
    [finalize, stop, log]
  );

  const clearError = useCallback(() => setError(null), []);

  return { supported, listeningSide, interim, error, events, start, stop, clearError };
}
