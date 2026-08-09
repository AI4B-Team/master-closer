import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { synthesizePreview } from "./voice.server";

const PreviewInput = z.object({
  base: z.string().min(1).max(40),
  style: z.string().max(400).nullish(),
  text: z.string().max(400).nullish(),
});

export const previewVoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PreviewInput.parse(input))
  .handler(async ({ data }) => ({ audio: await synthesizePreview(data) }));
