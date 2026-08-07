import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { callerOrg, polishPrompt, FEEDBACK_CATEGORIES } from "./help.server";

export { FEEDBACK_CATEGORIES };

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        body: z.string().min(3).max(4000),
        category: z.string().max(40).nullable().optional(),
        page: z.string().max(200).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const orgId = await callerOrg(context.supabase, context.userId);
    const { error } = await context.supabase.from("feedback").insert({
      org_id: orgId,
      user_id: context.userId,
      body: data.body,
      category: data.category ?? null,
      page: data.page ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const polishFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ body: z.string().min(3).max(4000), category: z.string().max(40).nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on this workspace.");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      prompt: polishPrompt(data.body, data.category ?? null),
      maxOutputTokens: 500,
      temperature: 0.4,
      providerOptions: { lovable: { reasoning: { enabled: false } } },
    });
    return { text: text.trim() };
  });

export const getTourStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("tour_status")
      .eq("id", context.userId)
      .maybeSingle();
    return { status: (data?.tour_status ?? null) as null | "skipped" | "completed" };
  });

export const setTourStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ status: z.enum(["skipped", "completed"]) }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("profiles")
      .update({ tour_status: data.status })
      .eq("id", context.userId);
    return { ok: true };
  });
