import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const SummarizeInput = z.object({
  mode: z.enum(["full_ai", "hybrid", "copilot"]),
  outcome: z.string().max(80).nullish(),
  prospect: z.string().max(160).nullish(),
  lines: z
    .array(z.object({ speaker: z.string().max(60), text: z.string().max(2000) }))
    .max(120)
    .default([]),
});

export const summarizeCall = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SummarizeInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on this workspace.");

    const modeDesc = {
      full_ai: "the AI ran the call end to end",
      hybrid: "the AI opened the call and a human closer finished it",
      copilot: "a human rep led the call while the AI suggested lines",
    }[data.mode];

    const transcript = data.lines.length
      ? data.lines.map((l) => `${l.speaker}: ${l.text}`).join("\n")
      : "(no transcript captured)";

    const { text } = await generateText({
      model: createLovableAiGatewayProvider(key)("google/gemini-3.6-flash"),
      prompt:
        `You write post-call wrap-ups for a sales team. On this call ${modeDesc}.\n` +
        `Prospect: ${data.prospect || "Unknown"}. Disposition: ${data.outcome || "Unknown"}.\n\n` +
        `Transcript:\n"""\n${transcript}\n"""\n\n` +
        `Return ONLY JSON, no fences, shaped:\n` +
        `{"summary":"...","next_step":"...","sentiment":"Hot|Warm|Cold"}\n` +
        `Rules: summary is 2-3 plain sentences covering what the prospect wants, the main objection, and where it landed. ` +
        `next_step is one concrete action for the rep, under 90 chars, in Title Case-free plain language. No fluff.`,
      maxOutputTokens: 500,
      temperature: 0.4,
      providerOptions: { lovable: { reasoning: { enabled: false } } },
    });

    const cleaned = text.replace(/```[a-z]*|```/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    try {
      const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
      return z
        .object({
          summary: z.string(),
          next_step: z.string().nullish(),
          sentiment: z.string().nullish(),
        })
        .parse(parsed);
    } catch {
      return { summary: cleaned.slice(0, 600), next_step: null, sentiment: null };
    }
  });
