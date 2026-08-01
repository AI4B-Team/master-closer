import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Call lists: read them, and push a whole list into a campaign as leads. */
export const Route = createFileRoute("/api/v1/lists")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase } = await apiClient(request);
          const { data, error } = await supabase
            .from("call_lists")
            .select("*, list_contacts(id, name, phone, email, attempts, last_outcome, consent)")
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
          const { supabase, orgId } = await apiClient(request);
          const body = z
            .object({
              list_id: z.string().uuid(),
              campaign_id: z.string().uuid(),
            })
            .parse(await request.json());

          const { data: contacts, error: cErr } = await supabase
            .from("list_contacts")
            .select("name, phone, email, consent")
            .eq("list_id", body.list_id);
          if (cErr) throw new Error(cErr.message);
          if (!contacts?.length) return Response.json({ error: "List is empty" }, { status: 400 });

          const { data: campaign, error: kErr } = await supabase
            .from("campaigns")
            .select("id, name, mode")
            .eq("id", body.campaign_id)
            .maybeSingle();
          if (kErr) throw new Error(kErr.message);
          if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });

          const { data: inserted, error: iErr } = await supabase
            .from("leads")
            .insert(
              contacts.map((c) => ({
                org_id: orgId,
                name: c.name,
                phone: c.phone,
                email: c.email,
                consent: c.consent,
                source: `campaign:${campaign.name}`,
              })),
            )
            .select("id");
          if (iErr) throw new Error(iErr.message);

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "leads.new", {
            count: inserted?.length ?? 0,
            campaign_id: campaign.id,
            list_id: body.list_id,
          });

          return Response.json({ pushed: inserted?.length ?? 0, campaign_id: campaign.id }, { status: 201 });
        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
