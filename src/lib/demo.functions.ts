import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { MODE_META } from "./demo.server";


export const closeObjection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ prospect: z.string(), mode: z.string() }).parse(data),
  )

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
      `"line": ${m.lineDesc}. Keep it under 30 words, conversational, never pushy or manipulative.`;

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3.1-flash-lite"),
      prompt,
      maxOutputTokens: 200,
      temperature: 0.6,
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
