import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { synthesizePreview } from "./voice.server";
import { PreviewInput } from "./server-schemas";

export const previewVoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PreviewInput.parse(input))
  .handler(async ({ data }) => ({ audio: await synthesizePreview(data) }));
