import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Call lists: read them, and push a whole list into a campaign as leads. */
export const Route = createFileRoute("/api/v1/lists")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase, workspaceId } = await apiClient(request);
          const { data, error } = await supabase
            .from("call_lists")
            .select("*, list_contacts(id, name, phone, email, attempts, last_outcome, consent)")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(100);
          if (error) throw new Error(error.message);
          return Response.json({ lists: data ?? [] });
        } catch (e) {
          return apiError(e);
        }
      },
      POST: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase, orgId, workspaceId } = await apiClient(request);
          const body = z
            .object({
              list_id: z.string().uuid(),
              campaign_id: z.string().uuid(),
            })
            .parse(await request.json());

          const { data: contacts, error: cErr } = await supabase
            .from("list_contacts")
            .select("name, phone, email, consent")
            .eq("workspace_id", workspaceId)
            .eq("list_id", body.list_id);
          if (cErr) throw new Error(cErr.message);
          if (!contacts?.length) return Response.json({ error: "List is empty" }, { status: 400 });

          const { data: campaign, error: kErr } = await supabase
            .from("campaigns")
            .select("id, name, mode")
            .eq("workspace_id", workspaceId)
            .eq("id", body.campaign_id)
            .maybeSingle();
          if (kErr) throw new Error(kErr.message);
          if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });

          // Pushing a list into a campaign is outreach: opted-out, Do Not Call
          // and Core-suppressed numbers are flagged so nothing dials them.
          const { fetchBlockedPhoneKeysServer } = await import("@/lib/dnc.server");
          const { phoneKey } = await import("@/lib/phone");
          const { screenInboundEmails } = await import("@/lib/core/screening.server");
          const blocked = await fetchBlockedPhoneKeysServer(supabase, workspaceId);
          // Emails travel with the leads, so screen them against the family-wide
          // opt-out list in one bulk call before anything can be mailed.
          const emailScreen = await screenInboundEmails({
            workspaceId,
            emails: contacts.map((c) => c.email ?? "").filter(Boolean),
            reasonPrefix: "api_list_push",
          });
          let suppressed = 0;
          let emailSuppressed = 0;
          const rows = contacts.map((c) => {
            const k = phoneKey(c.phone);
            const isBlocked = c.consent === "opt_out" || (!!k && blocked.has(k));
            if (isBlocked) suppressed += 1;
            const emailKey = c.email?.trim().toLowerCase();
            const emailBlocked = !!emailKey && emailScreen.suppressed.has(emailKey);
            if (emailBlocked) emailSuppressed += 1;
            return {
              org_id: orgId,
              workspace_id: workspaceId,
              name: c.name,
              phone: c.phone,
              email: c.email,
              consent: isBlocked || emailBlocked ? ("opt_out" as const) : c.consent,
              source: `campaign:${campaign.name}`,
            };
          });

          const { data: inserted, error: iErr } = await supabase.from("leads").insert(rows).select("id");
          if (iErr) throw new Error(iErr.message);

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "leads.new", {
            count: inserted?.length ?? 0,
            suppressed,
            email_suppressed: emailSuppressed,
            campaign_id: campaign.id,
            list_id: body.list_id,
          }, workspaceId);

          return Response.json(
            {
              pushed: inserted?.length ?? 0,
              dialable: (inserted?.length ?? 0) - suppressed,
              suppressed,
              email_suppressed: emailSuppressed,
              email_screen_unavailable: emailScreen.coreUnavailable,
              campaign_id: campaign.id,
            },
            { status: 201 },
          );


        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
