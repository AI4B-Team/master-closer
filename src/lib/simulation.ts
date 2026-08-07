/**
 * Dialer simulation script.
 *
 * Used until live telephony credentials are connected. The prospect lines are
 * fed into the same AI assist pipeline a real call uses, so what you see on
 * screen is the real product behavior with a scripted caller.
 */

export type SimProspect = { at: number; text: string };

/** Prospect lines, keyed to seconds after connect. */
export const SIM_SCRIPT: SimProspect[] = [
  { at: 6, text: "Yeah, this is Victor — what's this about?" },
  { at: 18, text: "We're pretty covered already. What makes you different?" },
  { at: 32, text: "Honestly, your competitor is cheaper." },
  { at: 48, text: "I'd have to see how it handles after-hours calls." },
  { at: 64, text: "I need to think about it and talk to my partner." },
  { at: 80, text: "Okay — send the agreement over and I'll look tonight." },
];

/** Fake ring/connect cadence in ms. */
export const SIM_RING_MS = 1600;

export const SIM_PROSPECTS = [
  { name: "Victor Ellis", phone: "+1 407 555 0118", company: "Ellis HVAC" },
  { name: "Dana Whitfield", phone: "+1 305 555 0142", company: "Northbridge Systems" },
  { name: "Sheila Kwon", phone: "+1 480 555 0154", company: "Apex Solar" },
];
