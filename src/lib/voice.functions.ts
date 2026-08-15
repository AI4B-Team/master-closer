import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { synthesizePreview } from "./voice.server";
import { PreviewInput } from "./server-schemas";

export const previewVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewInput.parse(input))
  .handler(async ({ data }) => ({ audio: await synthesizePreview(data) }));
