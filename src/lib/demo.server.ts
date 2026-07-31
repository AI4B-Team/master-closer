export const MODE_META: Record<string, { persona: string; lineDesc: string }> = {
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
