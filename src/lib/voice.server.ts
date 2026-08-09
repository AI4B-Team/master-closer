export type VoicePreset = {
  id: string;
  label: string;
  base: string;
  blurb: string;
  style: string;
};

/** Built-in closer voices. `base` maps to the TTS provider voice. */
export const VOICE_PRESETS: VoicePreset[] = [
  { id: "aria", label: "Aria", base: "shimmer", blurb: "Warm Female · Consultative", style: "Speak warmly and confidently, like a trusted advisor closing a deal." },
  { id: "marcus", label: "Marcus", base: "onyx", blurb: "Confident Male · Direct", style: "Speak with calm authority, direct and assertive, never pushy." },
  { id: "june", label: "June", base: "nova", blurb: "Bright Female · Energetic", style: "Speak brightly and upbeat with friendly energy." },
  { id: "neutral", label: "Neutral", base: "alloy", blurb: "Neutral · Balanced", style: "Speak in a clear, neutral, professional tone." },
  { id: "dean", label: "Dean", base: "echo", blurb: "Steady Male · Reassuring", style: "Speak slowly and reassuringly, lowering pressure on the prospect." },
  { id: "sable", label: "Sable", base: "sage", blurb: "Smooth Female · Premium", style: "Speak smoothly and elegantly, premium and unhurried." },
];

export const PREVIEW_LINE =
  "Hi, this is your closer with Master Closer. I know price matters — let me show you exactly what you get.";

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
