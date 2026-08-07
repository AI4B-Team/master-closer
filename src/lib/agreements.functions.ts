import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public signing endpoints. The 48-char random token in the URL is the bearer:
 * it is unguessable, scoped to one agreement, and only ever exposes that row's
 * signing surface (never the workspace).
 */

const TokenSchema = z.object({ token: z.string().min(20).max(120) });

type PublicAgreement = {
  id: string;
  title: string;
  body: string;
  amount: number;
  currency: string;
  status: string;
  signerName: string | null;
  signerEmail: string | null;
  signedAt: string | null;
  signatureType: string | null;
  signatureData: string | null;
  fileName: string | null;
  fileUrl: string | null;
  orgName: string | null;
};

export const getAgreementByToken = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => TokenSchema.parse(data))
  .handler(async ({ data }): Promise<PublicAgreement | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("agreements")
      .select("id, org_id, title, body, amount, currency, status, signer_name, signer_email, signed_at, signature_type, signature_data, file_path, file_name, viewed_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row || row.status === "draft" || row.status === "void") return null;

    // First open flips sent -> viewed so the closer sees engagement in real time.
    if (row.status === "sent") {
      await supabaseAdmin
        .from("agreements")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", row.id);
      await supabaseAdmin.from("agreement_events").insert({
        agreement_id: row.id,
        org_id: row.org_id,
        event_type: "viewed",
        meta: {},
      });
    }

    let fileUrl: string | null = null;
    if (row.file_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("agreements")
        .createSignedUrl(row.file_path, 60 * 30);
      fileUrl = signed?.signedUrl ?? null;
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", row.org_id)
      .maybeSingle();

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      amount: Number(row.amount ?? 0),
      currency: row.currency,
      status: row.status === "sent" ? "viewed" : row.status,
      signerName: row.signer_name,
      signerEmail: row.signer_email,
      signedAt: row.signed_at,
      signatureType: row.signature_type,
      signatureData: row.signature_data,
      fileName: row.file_name,
      fileUrl,
      orgName: org?.name ?? null,
    };
  });

export const signAgreement = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(20).max(120),
        signerName: z.string().trim().min(2).max(120),
        signerEmail: z.string().trim().email().max(200),
        signatureType: z.enum(["typed", "drawn"]),
        signatureData: z.string().min(2).max(400_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { data: row } = await supabaseAdmin
      .from("agreements")
      .select("id, org_id, status, deal_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("This agreement link is no longer valid.");
    if (row.status === "signed") return { ok: true, alreadySigned: true };
    if (row.status !== "sent" && row.status !== "viewed") {
      throw new Error("This agreement is not open for signature.");
    }

    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const signedAt = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("agreements")
      .update({
        status: "signed",
        signed_at: signedAt,
        signer_name: data.signerName,
        signer_email: data.signerEmail,
        signature_type: data.signatureType,
        signature_data: data.signatureData,
        signer_ip: ip,
      })
      .eq("id", row.id);
    if (error) throw error;

    await supabaseAdmin.from("agreement_events").insert({
      agreement_id: row.id,
      org_id: row.org_id,
      event_type: "signed",
      meta: { signer: data.signerName, email: data.signerEmail, method: data.signatureType, ip },
    });

    if (row.deal_id) {
      await supabaseAdmin.from("deals").update({ stage: "won", close_probability: 100 }).eq("id", row.deal_id);
    }

    return { ok: true, alreadySigned: false };
  });

export const declineAgreement = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(20).max(120), reason: z.string().trim().max(500).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("agreements")
      .select("id, org_id, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("This agreement link is no longer valid.");
    if (row.status === "signed") throw new Error("This agreement is already signed.");

    await supabaseAdmin
      .from("agreements")
      .update({ status: "declined", declined_at: new Date().toISOString() })
      .eq("id", row.id);
    await supabaseAdmin.from("agreement_events").insert({
      agreement_id: row.id,
      org_id: row.org_id,
      event_type: "declined",
      meta: { reason: data.reason ?? null },
    });
    return { ok: true };
  });
