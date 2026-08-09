import {
  Activity,
  DollarSign,
  FileSignature,
  Megaphone,
  PhoneCall,
  ShieldOff,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

/** Title-case a machine string like "agreement.sent" -> "Agreement Sent". */
function humanize(kind: string) {
  return kind
    .replace(/[._]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type EventRow = { id: string; event_type: string; payload: unknown; created_at: string };

export type EventDescription = { icon: LucideIcon; label: string; detail: string; kind: string };

const money = (v: unknown) => (v ? `$${Number(v).toLocaleString()}` : null);
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/**
 * Single source of truth for how a raw workspace event renders in the
 * dashboard feed and the Activity Log. Payload `kind` wins over `event_type`
 * because the hub vocabulary funnels everything through `job.completed`.
 */
export function describeEvent(e: EventRow): EventDescription {
  const p = (e.payload ?? {}) as Record<string, any>;
  const kind = String(p.kind ?? e.event_type);
  switch (kind) {
    case "agreement.sent":
      return { kind, icon: FileSignature, label: "Agreement Sent", detail: join(p.signer_email, money(p.amount)) };
    case "agreement.signed":
      return {
        kind,
        icon: FileSignature,
        label: "Agreement Signed",
        detail: join(p.signer_name ?? p.signer_email, money(p.amount)),
      };
    case "agreement.declined":
      return { kind, icon: ShieldOff, label: "Agreement Declined", detail: join(p.title, p.reason) };
    case "agreement.link_copied":
      return { kind, icon: FileSignature, label: "Signing Link Copied", detail: join(p.title, p.signer_email) };
    case "deal.won":
      return { kind, icon: DollarSign, label: "Deal Won", detail: join(p.title, money(p.value)) };
    case "leads.new":
      return { kind, icon: UserPlus, label: "New Lead", detail: join(p.name ?? p.email) };
    case "lead.flagged_dnc":
      return { kind, icon: ShieldOff, label: "Flagged Do Not Call", detail: join(p.phone ?? p.name, p.reason) };
    case "campaign.launched":
      return { kind, icon: Megaphone, label: "Campaign Launched", detail: join(p.name, p.mode) };
    case "call.completed":
      return { kind, icon: PhoneCall, label: "Call Completed", detail: join(p.lead_name, p.disposition) };
    default:
      return { kind, icon: Activity, label: humanize(kind), detail: "" };
  }
}
