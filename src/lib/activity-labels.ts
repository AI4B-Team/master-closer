import {
  Activity,
  BarChart3,
  Check,

  DollarSign,
  FileSignature,
  History,
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
    case "leads.imported":
      return {
        kind,
        icon: UserPlus,
        label: "Leads Imported",
        detail: p.count ? `${p.count} lead${Number(p.count) === 1 ? "" : "s"}` : "",
      };
    case "lead.flagged_dnc":
      return { kind, icon: ShieldOff, label: "Flagged Do Not Call", detail: join(p.phone ?? p.name, p.reason) };
    case "campaign.launched":
      return { kind, icon: Megaphone, label: "Campaign Launched", detail: join(p.name, p.mode) };
    case "report.digest":
      return { kind, icon: BarChart3, label: p.name ? `Digest · ${p.name}` : "Report Digest", detail: String(p.message ?? "") };
    case "call.completed":
      return { kind, icon: PhoneCall, label: "Call Completed", detail: join(p.lead_name, p.disposition) };
    case "prompt.updated":
      return { kind, icon: History, label: "Closer Prompt Updated", detail: join(p.name) };
    case "prompt.restored":
      return { kind, icon: History, label: "Closer Prompt Restored", detail: p.version ? `Version ${p.version}` : "" };
    case "profile.updated":
      return { kind, icon: History, label: "Closer Profile Saved", detail: join(p.name, p.industry) };
    case "profile.restored":
      return { kind, icon: History, label: "Closer Profile Restored", detail: p.version ? `Version ${p.version}` : "" };
    case "objection.approved":
      return { kind, icon: Check, label: "Objection Approved", detail: join(p.trigger) };
    case "objection.dismissed":
      return { kind, icon: ShieldOff, label: "Objection Dismissed", detail: join(p.trigger) };
    case "objection.reopened":
      return { kind, icon: Check, label: "Objection Reopened", detail: join(p.trigger) };
    case "line.promoted":
      return { kind, icon: BarChart3, label: "Line Promoted Into Profile", detail: join(p.trigger) };

    default:
      return { kind, icon: Activity, label: humanize(kind), detail: "" };
  }
}

/**
 * Where a feed row should navigate. Only leads support a deep param today,
 * so everything else lands on the owning list page.
 */
export function eventHref(e: EventRow): string | null {
  const p = (e.payload ?? {}) as Record<string, any>;
  const kind = String(p.kind ?? e.event_type);
  if (kind.startsWith("agreement.")) return p.agreement_id ? `/agreements?agreement=${p.agreement_id}` : "/agreements";
  if (kind.startsWith("deal.")) return p.deal_id ? `/pipeline?deal=${p.deal_id}` : "/pipeline";
  if (kind === "leads.new" && p.lead_id) return `/leads?lead=${p.lead_id}`;
  if (kind.startsWith("leads.")) return "/leads";
  if (kind === "lead.flagged_dnc") return "/lists";
  if (kind.startsWith("lead.")) return p.lead_id ? `/leads?lead=${p.lead_id}` : "/leads";
  if (kind === "report.digest") return "/team";
  if (kind.startsWith("campaign.")) return "/campaigns";

  if (kind.startsWith("agent.")) return "/ai-closers";
  if (kind.startsWith("prompt.")) return "/ai-closers";
  if (kind.startsWith("profile.")) return "/closer-profiles";
  if (kind.startsWith("consent.") || kind.startsWith("disclosure.")) return p.call_id ? `/calls?call=${p.call_id}` : "/calls";
  if (kind.startsWith("task.")) return "/tasks";
  if (kind.startsWith("call.") && p.call_id) return `/calls?call=${p.call_id}`;
  if (kind.startsWith("call.")) return "/calls";
  return null;
}
