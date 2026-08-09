import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/back-office/ui";

type LineRow = {
  id: string;
  product_line: string;
  status: string;
  disposition: string | null;
  touches: number;
  last_touch_at: string | null;
};

function when(iso: string | null) {
  if (!iso) return "Never Touched";
  return new Date(iso).toLocaleDateString();
}

/**
 * Contact-level product lines. One person can be worked on several product
 * lines at once; suppressing the contact kills every line in one tap.
 */
export function LeadLines({ leadId, phone }: { leadId: string; phone?: string | null }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const contactQ = useQuery({
    queryKey: ["contact-for-lead", leadId, phone ?? ""],
    queryFn: async () => {
      const byCrm = await supabase
        .from("contacts")
        .select("id, name, phone, suppressed, workspace_id")
        .eq("crm_id", leadId)
        .maybeSingle();
      if (byCrm.data) return byCrm.data;
      if (!phone) return null;
      const byPhone = await supabase
        .from("contacts")
        .select("id, name, phone, suppressed, workspace_id")
        .eq("phone", phone)
        .maybeSingle();
      return byPhone.data ?? null;
    },
  });

  const contact = contactQ.data;

  const linesQ = useQuery({
    queryKey: ["lead-lines", contact?.id],
    enabled: !!contact?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_lines")
        .select("id, product_line, status, disposition, touches, last_touch_at")
        .eq("contact_id", contact!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LineRow[];
    },
  });

  const addLine = useMutation({
    mutationFn: async (product: string) => {
      if (!contact) throw new Error("This lead has no contact record yet.");
      const { error } = await supabase.from("lead_lines").insert({
        workspace_id: contact.workspace_id,
        contact_id: contact.id,
        product_line: product,
        status: "live",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      toast.success("Product Line Added");
      void qc.invalidateQueries({ queryKey: ["lead-lines", contact?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not add that product line."),
  });

  const suppress = useMutation({
    mutationFn: async (next: boolean) => {
      if (!contact) throw new Error("This lead has no contact record yet.");
      const { error } = await supabase
        .from("contacts")
        .update({ suppressed: next, suppressed_at: next ? new Date().toISOString() : null })
        .eq("id", contact.id);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      toast.success(next ? "Contact Suppressed Across All Lines" : "Contact Re-Enabled");
      void qc.invalidateQueries({ queryKey: ["contact-for-lead"] });
      void qc.invalidateQueries({ queryKey: ["lead-lines", contact?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not change suppression."),
  });

  if (contactQ.isLoading) return <p className="text-sm text-[#6B6B76]">Loading product lines…</p>;

  if (!contact) {
    return (
      <p className="text-sm text-[#6B6B76]">
        No contact record for this lead yet. Contacts are created when leads are imported or when
        Lead Scout next reads the book.
      </p>
    );
  }

  const lines = linesQ.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {contact.suppressed ? (
          <StatusPill label="Suppressed — Every Line Off" tone="red" />
        ) : (
          <StatusPill label={`${lines.filter((l) => l.status === "live").length} Live Lines`} tone="green" />
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={contact.suppressed ? "text-[#0B8A4B]" : "text-[#CC0000]"}
          onClick={() => suppress.mutate(!contact.suppressed)}
          disabled={suppress.isPending}
        >
          {contact.suppressed ? (
            <>
              <ShieldCheck className="h-4 w-4 mr-1" /> Re-Enable Contact
            </>
          ) : (
            <>
              <Ban className="h-4 w-4 mr-1" /> Suppress Contact
            </>
          )}
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-[#6B6B76]">No product lines on this contact yet.</p>
      ) : (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between rounded-xl border border-[#E7E7EC] px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium capitalize">{l.product_line.replace(/_/g, " ")}</p>
                <p className="text-xs text-[#6B6B76]">
                  {l.disposition ? `${l.disposition} · ` : ""}
                  {l.touches} Touches · Last {when(l.last_touch_at)}
                </p>
              </div>
              <StatusPill
                label={l.status === "live" ? "Live" : l.status === "won" ? "Won" : "Inactive"}
                tone={l.status === "live" ? "green" : l.status === "won" ? "green" : "neutral"}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a product line, e.g. refinance"
          className="h-9"
        />
        <Button
          type="button"
          size="sm"
          className="bg-[#111114] hover:bg-[#111114]/90 rounded-xl"
          onClick={() => draft.trim() && addLine.mutate(draft.trim().toLowerCase())}
          disabled={!draft.trim() || addLine.isPending}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}
