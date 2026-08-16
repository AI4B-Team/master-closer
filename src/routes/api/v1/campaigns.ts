import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Counts how much of a list can actually be dialed before a campaign goes live.
 * Never blocks the launch: a Core outage returns `unavailable` so the caller
 * knows the number is unverified rather than reading zero as "all clear".
 */
async function screenCampaignList(
  supabase: any,
  workspaceId: string,
  listId: string,
): Promise<{
  total: number;
  dialable: number;
  suppressed: number;
  unavailable: boolean;
}> {
  const { data: rows } = await supabase
    .from("list_contacts")
    .select("phone")
    .eq("workspace_id", workspaceId)
    .eq("list_id", listId)
    .limit(5000);

  const { toE164 } = await import("@/lib/core/tenancy.server");
  const identifiers = Array.from(
    new Set(((rows ?? []) as { phone: string | null }[]).map((r) => toE164(r.phone ?? "")).filter(Boolean) as string[]),
  );
  const total = identifiers.length;
  if (!total) return { total: 0, dialable: 0, suppressed: 0, unavailable: false };

  const { coreLinkForWorkspace, assertBulkAll, logScreenRows } = await import(
    "@/lib/core/screening.server"
  );
  const link = await coreLinkForWorkspace(workspaceId);
  if (!link) return { total, dialable: total, suppressed: 0, unavailable: false };

  try {
    const { rows: screened } = await assertBulkAll({
      coreWorkspaceId: link.coreWorkspaceId,
      identifiers,
      actorId: workspaceId,
    });
    await logScreenRows({
      workspaceId,
      coreWorkspaceId: link.coreWorkspaceId,
      actorId: workspaceId,
      rows: screened,
    });
    const dialable = screened.filter((r) => r.decision === "allow").length;
    return { total, dialable, suppressed: total - dialable, unavailable: false };
  } catch {
    return { total, dialable: 0, suppressed: 0, unavailable: true };
  }
}

/** Campaigns are creatable/launchable over HTTP so the hub can act, not rebuild. */
export const Route = createFileRoute("/api/v1/campaigns")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase, workspaceId } = await apiClient(request);
          const { data, error } = await supabase
            .from("campaigns")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(200);
          if (error) throw new Error(error.message);
          return Response.json({ campaigns: data ?? [] });
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
              name: z.string().min(1).max(200),
              mode: z.enum(["full_ai", "hybrid", "copilot"]).default("copilot"),
              agent_id: z.string().uuid().nullish(),
              list_id: z.string().uuid().nullish(),
              launch: z.boolean().default(true),
            })
            .parse(await request.json());

          // A caller can only wire up an AI closer and a call list that belong to
          // the workspace the token resolves to — otherwise a campaign would run
          // on another tenant's agent config or point at a list it cannot read.
          if (body.agent_id) {
            const { data: agent } = await supabase
              .from("agents")
              .select("id")
              .eq("id", body.agent_id)
              .eq("workspace_id", workspaceId)
              .maybeSingle();
            if (!agent) return Response.json({ error: "AI closer not found in this workspace." }, { status: 404 });
          }
          if (body.list_id) {
            const { data: list } = await supabase
              .from("call_lists")
              .select("id")
              .eq("id", body.list_id)
              .eq("workspace_id", workspaceId)
              .maybeSingle();
            if (!list) return Response.json({ error: "Call list not found in this workspace." }, { status: 404 });
          }



          const { data, error } = await supabase
            .from("campaigns")
            .insert({
              org_id: orgId,
              workspace_id: workspaceId,
              name: body.name,
              mode: body.mode,
              agent_id: body.agent_id ?? null,
              list_id: body.list_id ?? null,
              status: body.launch ? "active" : "draft",
            })
            .select("*")
            .single();
          if (error) throw new Error(error.message);

          // Screening a launch is advisory: it tells the caller how much of the
          // list is actually dialable. The dialer still asserts per call.
          const screening = body.launch && body.list_id
            ? await screenCampaignList(supabase, workspaceId, body.list_id)
            : null;

          if (body.launch) {
            const { emitEvent } = await import("@/lib/hub.server");
            await emitEvent(orgId, "campaign.launched", {
              campaign_id: data.id,
              name: data.name,
              mode: data.mode,
              ...(screening
                ? { dialable: screening.dialable, suppressed: screening.suppressed }
                : {}),
            }, workspaceId);
          }

          return Response.json({ campaign: data, screening }, { status: 201 });
        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
