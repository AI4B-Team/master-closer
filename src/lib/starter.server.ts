import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<any, "public", any>;

/** Result of a starter-data load: what we created and what we left alone. */
export type StarterResult = { created: string[]; skipped: string[] };

const LEADS = [
  { name: "Dana Whitfield", company: "Whitfield Roofing", title: "Owner", phone: "+19175550142", email: "dana@whitfieldroofing.com", source: "Referral", notes: "Quoted last spring, went quiet on price." },
  { name: "Marcus Reyes", company: "Reyes Home Services", title: "GM", phone: "+13055550188", email: "marcus@reyeshome.com", source: "Web Form", notes: "Wants weekend install windows." },
  { name: "Priya Nair", company: "Northline Solar", title: "VP Sales", phone: "+16175550119", email: "priya@northlinesolar.com", source: "Inbound Call", notes: "Comparing against a cheaper competitor." },
];

const CONTACTS = [
  { name: "Dana Whitfield", phone: "+19175550142", email: "dana@whitfieldroofing.com" },
  { name: "Marcus Reyes", phone: "+13055550188", email: "marcus@reyeshome.com" },
  { name: "Priya Nair", phone: "+16175550119", email: "priya@northlinesolar.com" },
  { name: "Alan Brody", phone: "+14155550173", email: "alan@brodyhvac.com" },
];

const OBJECTIONS = [
  {
    trigger: "Honestly, your competitor is cheaper.",
    response: "That's fair — cheaper usually means a thinner crew and a longer timeline. Which matters more on this job: the invoice or the finish date?",
    category: "Price",
  },
  {
    trigger: "I need to think about it.",
    response: "Totally reasonable. So I know what to send over — is it the price, the timing, or whether this fits at all?",
    category: "Stall",
  },
  {
    trigger: "Send me some information.",
    response: "Happy to. Information without your numbers in it is just a brochure — give me two minutes and I'll send the version that actually applies to you.",
    category: "Brush-Off",
  },
];

const PLAYBOOK_BODY = `# Starter Playbook

## Open
Lead with the disclosure, then the reason for the call in one sentence.

## Qualify
Budget, timeline, and who else signs off. Never more than three questions before you give something back.

## Handle
Name the objection out loud, then reframe to outcome — not features.

## Close
Ask for a specific next step with a date attached. Silence is a "no" you can still fix.`;

/**
 * Loads a realistic starter workspace: one AI closer, a call list with
 * contacts, leads, a campaign, an objection library and a playbook.
 *
 * Every step is skipped when that table already has rows for the workspace,
 * so running it twice never duplicates anything.
 */
export async function loadStarterData(supabase: Client, userId: string): Promise<StarterResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("org_id, active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (profErr) throw profErr;
  const orgId = profile?.org_id as string | undefined;
  const wsId = profile?.active_workspace_id as string | undefined;
  if (!orgId || !wsId) throw new Error("No active workspace to load starter data into.");

  const base = { org_id: orgId, workspace_id: wsId };

  const isEmpty = async (table: string) => {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId);
    if (error) throw error;
    return (count ?? 0) === 0;
  };

  // 1. AI closer
  let agentId: string | null = null;
  if (await isEmpty("agents")) {
    const { data, error } = await supabase
      .from("agents")
      .insert({
        ...base,
        name: "Aria — Home Services Closer",
        industry: "Home Services",
        default_mode: "hybrid",
        voice: "aria",
        voices: ["aria"],
        active: true,
        system_prompt:
          "You are a closer for a home services company. Open with the disclosure, qualify budget and timeline, and never argue price — reframe to value.",
      })
      .select("id")
      .single();
    if (error) throw error;
    agentId = data.id as string;
    created.push("AI closer");
  } else {
    const { data } = await supabase.from("agents").select("id").eq("workspace_id", wsId).limit(1).maybeSingle();
    agentId = (data?.id as string) ?? null;
    skipped.push("AI closer");
  }

  // 2. Leads
  if (await isEmpty("leads")) {
    const { error } = await supabase.from("leads").insert(
      LEADS.map((l) => ({ ...base, ...l, status: "new", consent: "implied", owner_id: userId })),
    );
    if (error) throw error;
    created.push("Leads");
  } else {
    skipped.push("Leads");
  }

  // 3. Contacts (dialer surface)
  if (await isEmpty("contacts")) {
    const { error } = await supabase
      .from("contacts")
      .insert(CONTACTS.map((c) => ({ ...base, ...c, timezone: "America/New_York" })));
    if (error) throw error;
    created.push("Contacts");
  } else {
    skipped.push("Contacts");
  }

  // 4. Call list + list contacts
  let listId: string | null = null;
  if (await isEmpty("call_lists")) {
    const { data, error } = await supabase
      .from("call_lists")
      .insert({ ...base, name: "Warm Callbacks" })
      .select("id")
      .single();
    if (error) throw error;
    listId = data.id as string;
    const { error: lcErr } = await supabase.from("list_contacts").insert(
      CONTACTS.map((c) => ({ workspace_id: wsId, list_id: listId!, name: c.name, phone: c.phone, email: c.email, consent: "implied" })),
    );
    if (lcErr) throw lcErr;
    created.push("Call list");
  } else {
    const { data } = await supabase.from("call_lists").select("id").eq("workspace_id", wsId).limit(1).maybeSingle();
    listId = (data?.id as string) ?? null;
    skipped.push("Call list");
  }

  // 5. Campaign wired to the closer and the list
  if (await isEmpty("campaigns")) {
    const { error } = await supabase.from("campaigns").insert({
      ...base,
      name: "Warm Callback Sprint",
      mode: "hybrid",
      status: "draft",
      goal: "Rebook the quotes that went quiet on price.",
      daily_cap: 40,
      agent_id: agentId,
      list_id: listId,
    });
    if (error) throw error;
    created.push("Campaign");
  } else {
    skipped.push("Campaign");
  }

  // 6. Objection library
  if (await isEmpty("objections")) {
    const { error } = await supabase.from("objections").insert(OBJECTIONS.map((o) => ({ ...base, ...o })));
    if (error) throw error;
    created.push("Objection library");
  } else {
    skipped.push("Objection library");
  }

  // 7. Playbook
  if (await isEmpty("playbooks")) {
    const { error } = await supabase.from("playbooks").insert({
      ...base,
      name: "Home Services Starter",
      description: "Open, qualify, handle, close — the four beats of every call.",
      content: PLAYBOOK_BODY,
    });
    if (error) throw error;
    created.push("Playbook");
  } else {
    skipped.push("Playbook");
  }

  if (created.length) {
    await supabase.from("events").insert({
      ...base,
      event_type: "workspace.starter_loaded",
      payload: { kind: "workspace.starter_loaded", message: created.join(", ") },
    });
  }

  return { created, skipped };
}
