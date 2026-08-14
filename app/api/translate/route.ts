import { NextResponse } from "next/server";
import { isLangCode } from "@/lib/languages";
import { resolveProvider, translate } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const { text, from, to } = (body ?? {}) as {
    text?: unknown;
    from?: unknown;
    to?: unknown;
  };

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });
  }
  if (!isLangCode(from) || !isLangCode(to)) {
    return NextResponse.json({ error: "Unsupported language pair." }, { status: 400 });
  }
  if (from === to) {
    return NextResponse.json({
      translation: text.trim(),
      provider: resolveProvider(),
    });
  }

  try {
    const { translation, provider } = await translate({
      text: text.trim(),
      from,
      to,
    });
    return NextResponse.json({ translation, provider });
  } catch (error) {
    console.error("[translate]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Translation failed.",
      },
      { status: 502 }
    );
  }
}
