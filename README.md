# 🍵 ChaCha

*Two cups, two tongues.*

Pass-the-phone voice translation between two people speaking different
languages. One device, one screen, two big buttons.

The name is 茶 (*cha* — tea in Cantonese, Mandarin, and Japanese) crossed with
*chat*: a little table where two languages meet.

Supported languages: **English, Cantonese (廣東話), Mandarin (普通话), Japanese
(日本語), Spanish (Español), French (Français)**.

## How it works

```
speech  →  browser SpeechRecognition  →  text  →  /api/translate  →  translated text
```

| Stage | Who does it | Cost |
|---|---|---|
| Voice → text | The browser's native Web Speech API | free |
| Text → text | A pluggable provider (see below) | free or per-token |

Output is **text only** — each turn shows the speaker's words and the
translation on screen. There is no read-aloud; the two people are sitting
together and read the phone between them.

Speech recognition is a **device/browser** capability, not an LLM one — the
Claude API takes no audio. Chrome, Edge, and Safari implement it; Firefox does
not.

## Translation providers

Set `TRANSLATE_PROVIDER` in `.env.local`. Unset, it picks Claude if
`ANTHROPIC_API_KEY` exists and `google` otherwise — so the app works with no
configuration at all. All three live in `lib/providers.ts` behind one interface.

| Provider | Key? | Cantonese | Trade-off |
|---|---|---|---|
| `google` (default) | none | good, genuinely colloquial | Undocumented endpoint — no SLA, IP rate-limiting under load |
| `mymemory` | none | usable | 5k chars/day (50k with `MYMEMORY_EMAIL`) |
| `claude` | yes | best | Handles code-mixing, register, and garbled ASR output; ~$0.002/exchange |

The header shows which one answered.

## Setup

```bash
npm install && npm run dev
```

That's it — it translates out of the box with no key. For Claude quality, add
`ANTHROPIC_API_KEY` to `.env.local` (see `.env.example`).

## Using it

**Screen 1 — Setup.** Pick a primary language for each speaker. "Primary" is not
a restriction: recognition is biased toward that language, but the translator is
told to expect code-mixing and translates the whole utterance either way.

**Screen 2 — Chat.**

- Two fat buttons at the bottom, one per speaker, colour-coded
  (**A = blue**, **B = amber**). Tap to start, tap again to stop.
- Every bubble carries both languages: what was said on top, the translation
  underneath.
- The **Both / English / 廣東話** toggle decides which language leads. In a
  focused view, that speaker's language is on top of *every* bubble, so one
  person can read straight down the thread without hunting. The page tint
  changes with the view so it's obvious at a glance whose turn it is to read.
- Text only — no audio playback. Both people read the thread on the shared
  phone.

## Known limits

- **One language model per recording.** `SpeechRecognition` accepts a single
  locale per session, so a speaker who switches languages mid-sentence gets
  degraded *recognition* accuracy even though translation handles the mixing.
  Fixing this properly means moving to an audio-native model (see below).
- Recognition needs an internet connection on most platforms — Chrome streams
  the audio to Google's servers.

## Swapping the speech engine

`lib/useSpeech.ts` is the only place that touches `SpeechRecognition`, and the
translation call is server-side in `app/api/translate/route.ts`. To move to an
audio-native model (Gemini, `gpt-4o-transcribe`, Deepgram, Whisper), record with
`MediaRecorder` instead and post the blob to a new route — the chat UI does not
care where the text came from.

Read-aloud was intentionally dropped from this prototype (the two speakers share
the screen). To add it back, TTS is the browser's native `SpeechSynthesis` —
`speechSynthesis.speak(new SpeechSynthesisUtterance(text))` with a voice matched
to the target locale.

## Deploy

```bash
vercel
```

No environment variables are required. Add `ANTHROPIC_API_KEY` (and optionally
`TRANSLATE_PROVIDER`) if you want the Claude backend. HTTPS is required for
microphone access, which Vercel gives you by default.
