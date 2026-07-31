import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  prospect: z.string(),
  mode: z.string(),
});

const MODE_META: Record<string, { persona: string; lineDesc: string }> = {
  ai: {
    persona: "You ARE the AI closer speaking directly to the prospect on the call.",
    lineDesc:
      "the exact words the AI should say next to the prospect, moving naturally toward the close and, if it fits, offering to send the agreement or a payment link",
  },
  hybrid: {
    persona: "You are the AI that warmed up this lead and is about to live-transfer to a human closer.",
    lineDesc:
      "a short, private briefing line spoken to the human closer summarizing where the deal stands and the one move to make on the close",
  },
  copilot: {
    persona: "You are a silent copilot whispering to a human sales rep. Only the rep can see this.",
    lineDesc: "the exact words the rep should say next, natural, spoken, no preamble",
  },
};

export const closeObjection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const m = MODE_META[data.mode] ?? MODE_META.copilot;
    const prompt =
      `You are Master Closer, a real-time sales AI. ${m.persona}\n\n` +
      `The prospect just said: "${data.prospect}"\n\n` +
      `Respond with ONLY a JSON object (no markdown, no backticks, no commentary) with exactly these keys:\n` +
      `"objection": a 2-4 word label for what's really going on,\n` +
      `"tone": 1-2 words for the prospect's tone,\n` +
      `"confidence": an integer 0-100 estimate of close probability if the next move lands,\n` +
      `"line": ${m.lineDesc}. Keep it under 45 words, conversational, never pushy or manipulative.`;

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      prompt,
    });

    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : clean);
    return {
      objection: String(parsed.objection ?? "Objection"),
      tone: String(parsed.tone ?? "Neutral"),
      confidence: Number(parsed.confidence ?? 60),
      line: String(parsed.line ?? ""),
    };
  });
