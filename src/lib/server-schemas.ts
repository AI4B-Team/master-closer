/**
 * Input schemas for server functions.
 *
 * Kept out of the *.functions.ts modules: the server-function bundler splits
 * those files down to their exported createServerFn declarations, so any
 * runtime sibling (schemas included) can vanish and fail at call time.
 */
import { z } from "zod";

export const TokenSchema = z.object({ token: z.string().min(20).max(120) });
export const HubTokenInput = z.object({ token: z.string().min(10) });

export const SummarizeInput = z.object({
  mode: z.enum(["full_ai", "hybrid", "copilot"]),
  outcome: z.string().max(80).nullish(),
  prospect: z.string().max(160).nullish(),
  lines: z
    .array(z.object({ speaker: z.string().max(60), text: z.string().max(2000) }))
    .max(120)
    .default([]),
});

export const PromptHelpInput = z.object({
  name: z.string().min(1).max(120),
  industry: z.string().max(120).nullish(),
  mode: z.enum(["full_ai", "hybrid", "copilot"]),
  current: z.string().max(8000).nullish(),
  instruction: z.enum(["generate", "improve", "shorten", "tone"]).default("generate"),
});

export const SuggestObjectionsInput = z.object({
  industry: z.string().max(120).nullish(),
  focus: z.string().max(200).nullish(),
  existing: z.array(z.string().max(300)).max(50).default([]),
});

export const PreviewInput = z.object({
  base: z.string().min(1).max(40),
  style: z.string().max(400).nullish(),
  text: z.string().max(400).nullish(),
});

export const OrgRoleSchema = z.enum(["admin", "manager", "rep"]);
export const WsRoleSchema = z.enum(["owner", "admin", "member"]);
