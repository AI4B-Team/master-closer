import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const PromptHelpInput = z.object({
  name: z.string().min(1).max(120),
  industry: z.string().max(120).nullish(),
  mode: z.enum(["full_ai", "hybrid", "copilot"]),
  current: z.string().max(8000).nullish(),
  instruction: z.enum(["generate", "improve", "shorten", "tone"]).default("generate"),
});

export const helpSystemPrompt = createServerFn({ method: "POST" })
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
