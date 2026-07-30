export const DEFAULT_DISCLOSURE =
  "Quick heads up, this call may be recorded and monitored for quality and training.";

export type ConsentRule = "all_party" | "one_party";

export type StateRule = {
  code: string;
  name: string;
  consent: ConsentRule;
};

/** All-party (two-party) consent states — disclosure is Required. Everything else is Optional. */
const ALL_PARTY = new Set([
  "CA", "CT", "DE", "FL", "IL", "MD", "MA", "MI", "MT", "NV", "NH", "OR", "PA", "WA",
]);

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District Of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export const STATE_RULES: StateRule[] = Object.entries(STATE_NAMES).map(([code, name]) => ({
  code,
  name,
  consent: ALL_PARTY.has(code) ? "all_party" : "one_party",
}));

export function isDisclosureRequired(jurisdiction?: string | null): boolean {
  if (!jurisdiction) return true; // unknown jurisdiction → treat as Required
  return ALL_PARTY.has(jurisdiction.toUpperCase());
}

export function disclosureStatus(jurisdiction?: string | null): "Required" | "Optional" {
  return isDisclosureRequired(jurisdiction) ? "Required" : "Optional";
}

export type DeliveryMethodKey =
  | "spoken_at_call_open"
  | "booking_confirmation"
  | "outbound_pre_connect_audio";

export const DELIVERY_METHODS: { key: DeliveryMethodKey; label: string; hint: string }[] = [
  {
    key: "spoken_at_call_open",
    label: "Spoken At Call Open",
    hint: "The agent or rep delivers the line as the first utterance of the call.",
  },
  {
    key: "booking_confirmation",
    label: "Booking Confirmation",
    hint: "The line is included in the confirmation email and SMS sent at booking.",
  },
  {
    key: "outbound_pre_connect_audio",
    label: "Outbound Pre-Connect Audio",
    hint: "The dialer plays the line the moment the outbound call connects.",
  },
];
