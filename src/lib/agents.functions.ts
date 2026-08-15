import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { PromptHelpInput, SuggestObjectionsInput } from "./server-schemas";

export const helpSystemPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PromptHelpInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on this workspace.");

    const modeDesc = {
      full_ai: "AI runs the entire call autonomously",
      hybrid: "AI starts the call and warms the prospect, then a human closer takes over to finish",
      copilot: "A human rep leads the call while the AI whispers the next best response",
    }[data.mode];

    const action = {
      generate: "Write a complete system prompt",
      improve: "Improve this system prompt: make it sharper, more specific, and higher-converting",
      shorten: "Shorten this system prompt while preserving its core instructions and edge-case rules",
      tone: "Rewrite this system prompt to sound more confident, concise, and like a top-performing sales closer",
    }[data.instruction];

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      prompt:
        `${action} for an AI sales closer named "${data.name}" in the ${data.industry || "general sales"} industry. ` +
        `The closer operates in this mode: ${modeDesc}.\n\n` +
        (data.current ? `Current prompt:\n"""\n${data.current}\n"""\n\n` : "") +
        `Rules for the output:\n` +
        `- Return ONLY the system prompt text, no markdown fences, no commentary.\n` +
        `- Include: identity, opening disclosure, qualification goals, objection handling philosophy, tone, and a "never do" guardrail list.\n` +
        `- Keep it between 120 and 400 words.\n` +
        `- Sound like a calm, expert closer, not a chatbot.`,
      maxOutputTokens: 1200,
      temperature: 0.5,
      providerOptions: { lovable: { reasoning: { enabled: false } } },
    });

    return { prompt: text.replace(/^```[a-z]*\n?|```$/gim, "").trim() };
  });

export const suggestObjections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SuggestObjectionsInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on this workspace.");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      prompt:
        `You build objection libraries for elite sales teams in the ${data.industry || "general sales"} industry.\n` +
        (data.focus ? `Focus on this theme: ${data.focus}.\n` : "") +
        (data.existing.length
          ? `Do NOT repeat these existing objections:\n- ${data.existing.join("\n- ")}\n`
          : "") +
        `Return 6 hard, realistic objections a prospect actually says out loud, each with the exact words a top closer says back.\n` +
        `Return ONLY a JSON array, no markdown fences, no commentary, shaped:\n` +
        `[{"trigger":"...","category":"Price|Timing|Trust|Authority|Competitor|Fit","response":"..."}]\n` +
        `Rules: trigger under 120 chars in the prospect's voice; response 1-3 spoken sentences, no fluff, no "I understand"; category exactly one of the listed words.`,
      maxOutputTokens: 1400,
      temperature: 0.7,
      providerOptions: { lovable: { reasoning: { enabled: false } } },
    });

    const cleaned = text.replace(/```[a-z]*|```/gi, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    let parsed: unknown = [];
    try {
      parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    } catch {
      throw new Error("AI returned an unexpected format. Try again.");
    }
    const items = z
      .array(z.object({ trigger: z.string(), category: z.string().nullish(), response: z.string() }))
      .parse(parsed);
    return { items: items.slice(0, 8) };
  });
