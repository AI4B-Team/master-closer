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

export const BASE_VOICE_OPTIONS = [
  "alloy",
  "shimmer",
  "nova",
  "onyx",
  "echo",
  "sage",
  "fable",
] as const;

export const PREVIEW_LINE =
  "Hi, this is your closer with Master Closer. I know price matters — let me show you exactly what you get.";
