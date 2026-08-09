import { PREVIEW_LINE } from "./voices";

export async function synthesizePreview(input: {
  base: string;
  style?: string | null;
  text?: string | null;
}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Voice preview is not configured yet.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      input: input.text?.trim() || PREVIEW_LINE,
      voice: input.base,
      instructions: input.style || undefined,
      response_format: "mp3",
      stream_format: "audio",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to preview voices.");
    if (res.status === 429) throw new Error("Too many previews at once. Try again in a moment.");
    throw new Error(`Voice preview failed [${res.status}]: ${body}`);
  }

  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}
