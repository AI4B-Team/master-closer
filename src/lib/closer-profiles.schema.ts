/** Column list + input schemas for closer profile server functions. */
import { z } from "zod";

export const PROFILE_SELECT =
  "id, workspace_id, industry, source, name, is_default, opener, context_framing, objections, screening_questions, faqs, tone, escalation_triggers, banned_topics, dispositions, default_campaign_id, updated_at";

export const ObjectionSchema = z.object({
  trigger: z.string().trim().min(1).max(300),
  approved_response: z.string().trim().min(1).max(1200),
});

export const ProfileInput = z.object({
  id: z.string().uuid().nullish(),
  industry: z.string().trim().max(60).nullish(),
  source: z.string().trim().max(60).nullish(),
  name: z.string().trim().min(2).max(120),
  is_default: z.boolean().default(false),
  opener: z.string().trim().min(5).max(2000),
  context_framing: z.string().trim().max(2000).nullish(),
  objections: z.array(ObjectionSchema).max(60).default([]),
  screening_questions: z.array(z.string().trim().min(1).max(300)).max(40).default([]),
  faqs: z.array(z.string().trim().min(1).max(600)).max(60).default([]),
  tone: z.string().trim().max(300).nullish(),
  escalation_triggers: z.array(z.string().trim().min(1).max(160)).max(60).default([]),
  banned_topics: z.array(z.string().trim().min(1).max(160)).max(60).default([]),
  dispositions: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
});
