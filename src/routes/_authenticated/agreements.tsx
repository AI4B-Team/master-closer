import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/use-workspace";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, EmptyState, SkeletonRows, StatusPill } from "@/components/back-office/ui";
import {
  Copy, Download, FilePlus2, FileSignature, FileText, Send, Trash2, Upload, Star, Eye, History, Mail, Printer,
} from "lucide-react";
import { toCsv, downloadCsv, stampedName } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  applyMerge, DEFAULT_AGREEMENT_BODY, MERGE_TOKENS, money, remainingTokens, signingUrl,
  STATUS_TONE, type AgreementStatus,
} from "@/lib/agreements";
import { emailSigningLink, printSignedCopy } from "@/lib/agreement-print";
import { logActivity } from "@/lib/activity";


export const Route = createFileRoute("/_authenticated/agreements")({
  validateSearch: (q: Record<string, unknown>) => ({
    agreement: typeof q.agreement === "string" ? q.agreement : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Agreements — Master Closer" },
      { name: "description", content: "Upload, fill, send and e-sign closing agreements without leaving the call." },
      { property: "og:title", content: "Agreements — Master Closer" },
      { property: "og:description", content: "Upload, fill, send and e-sign closing agreements without leaving the call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgreementsPage,
});

const TABS = [
  { key: "sent", label: "Agreements" },
  { key: "templates", label: "Templates" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function AgreementsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("sent");

  const { data: me } = useQuery({
    queryKey: ["me-org"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("org_id, active_workspace_id, full_name, email").maybeSingle();
      return data;
    },
  });

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: templates } = useQuery({
    queryKey: ["agreement_templates", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_templates")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });


  const { data: agreements, isLoading: agreementsLoading } = useQuery({
    queryKey: ["agreements", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("*, leads(name, company)")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-min", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, company, email, phone")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agreements"] });
    qc.invalidateQueries({ queryKey: ["agreement_templates"] });
  };

  const stats = useMemo(() => {
    const rows = agreements ?? [];
    const signed = rows.filter((r: any) => r.status === "signed");
    return {
      total: rows.length,
      out: rows.filter((r: any) => r.status === "sent" || r.status === "viewed").length,
      signed: signed.length,
      value: signed.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0),
    };
  }, [agreements]);

  const [composeOpen, setComposeOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const sp = Route.useSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  /* Deep link: ?agreement=<id> opens that agreement's detail once the list loads. */
  useEffect(() => {
    if (!sp.agreement || detail) return;
    const hit = (agreements ?? []).find((a: any) => a.id === sp.agreement);
    if (hit) {
      setTab("sent");
      setDetail(hit);
    }
  }, [sp.agreement, agreements, detail]);

  /* Filter the sent list by free text (title, signer, lead) and status. */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (agreements ?? []).filter((a: any) => {
      const hit =
        !q ||
        [a.title, a.signer_name, a.signer_email, a.leads?.name, a.leads?.company]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(q));
      return hit && (statusFilter === "all" || a.status === statusFilter);
    });
  }, [agreements, search, statusFilter]);

  function exportCsv() {
    const rows = visible.map((a: any) => [
      a.title,
      a.status,
      a.signer_name ?? "",
      a.signer_email ?? "",
      a.leads?.name ?? "",
      a.leads?.company ?? "",
      a.signed_at ?? "",
      a.created_at ?? "",
    ]);
    if (rows.length === 0) {
      toast.error("Nothing to export yet.");
      return;
    }
    downloadCsv(
      stampedName("agreements"),
      toCsv(["Title", "Status", "Signer", "Email", "Lead", "Company", "Signed", "Created"], rows),
    );
    toast.success(`Exported ${rows.length} Agreement(s).`);
  }

  return (
    <div>
      <PageHeader
        title="Agreements"
        description="Upload it, fill it, send it and get it signed while the call is still warm."
        tabs={TAB_GROUPS.calls}
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              onClick={() => setComposeOpen(true)}
            >
              <FilePlus2 className="h-4 w-4 mr-1" /> New Agreement
            </Button>
          </div>
        }

      />

      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={"tab " + (tab === t.key ? "tab-on" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sent" ? (
        <>
          <div className="grid gap-3 md:grid-cols-4 mb-4">
            <MiniStat label="Total" value={String(stats.total)} />
            <MiniStat label="Out For Signature" value={String(stats.out)} />
            <MiniStat label="Signed" value={String(stats.signed)} />
            <MiniStat label="Signed Value" value={money(stats.value)} />
          </div>

          <Card className="rounded-2xl border-[#E7E7EC] shadow-none p-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by agreement, signer or lead"
                className="rounded-xl md:max-w-sm"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
              {search || statusFilter !== "all" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => { setSearch(""); setStatusFilter("all"); }}
                >
                  Clear Filters
                </Button>
              ) : null}
              <span className="ml-auto text-sm text-[#6B6B76]">
                <b className="text-[#111114]">{visible.length}</b> Agreements
              </span>
            </div>
          </Card>

          <Card className="rounded-2xl border-[#E7E7EC] shadow-none overflow-hidden">
            {agreementsLoading ? (
              <SkeletonRows rows={5} />
            ) : (agreements ?? []).length === 0 ? (
              <EmptyPanel
                icon={FileSignature}
                title="No Agreements Yet"
                hint="Create one from a template and send the signing link straight to the prospect."
                action={
                  <Button
                    type="button"
                    onClick={() => setTab("templates")}
                    className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]"
                  >
                    <FileText className="h-4 w-4 mr-1.5" /> Go To Templates
                  </Button>
                }
              />
            ) : visible.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#6B6B76]">
                No agreements match these filters.
              </div>
            ) : (
              <div className="mc-tablewrap"><table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#6B6B76] border-b border-[#EDEDF1]">
                    <th className="px-4 py-3 font-medium">Agreement</th>
                    <th className="px-4 py-3 font-medium">Signer</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((a: any) => (
                    <tr key={a.id} className="border-b border-[#F3F3F6] last:border-0">
                      <td className="px-4 py-3">
                        <button type="button" className="font-medium hover:underline" onClick={() => setDetail(a)}>
                          {a.title}
                        </button>
                        <div className="text-xs text-[#6B6B76]">
                          {a.leads?.name ?? "No lead linked"}
                          {a.leads?.company ? ` · ${a.leads.company}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.signer_name ?? "—"}
                        <div className="text-xs text-[#6B6B76]">{a.signer_email ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 font-num">{money(Number(a.amount ?? 0), a.currency)}</td>
                      <td className="px-4 py-3">
                        <StatusPill
                          label={String(a.status).toUpperCase()}
                          tone={STATUS_TONE[a.status as AgreementStatus] ?? "neutral"}
                        />
                      </td>
                      <td className="px-4 py-3 text-[#6B6B76]">
                        {new Date(a.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(a)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Card>
        </>
      ) : (
        <TemplatesTab templates={templates ?? []} orgId={me?.org_id ?? null} wsId={wsId} onChange={invalidate} />
      )}

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        templates={templates ?? []}
        leads={leads ?? []}
        orgId={me?.org_id ?? null}
        repName={me?.full_name ?? me?.email ?? "Your Closer"}
        onDone={() => {
          setComposeOpen(false);
          invalidate();
        }}
      />

      <AgreementDrawer agreement={detail} onClose={() => setDetail(null)} onChange={invalidate} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none">
      <div className="text-xs uppercase tracking-wide text-[#6B6B76]">{label}</div>
      <div className="text-2xl font-display font-semibold font-num mt-1">{value}</div>
    </Card>
  );
}

/* ---------------------------------- Templates ---------------------------------- */

function TemplatesTab({
  templates, orgId, wsId, onChange,
}: {
  templates: any[];
  orgId: string | null;
  wsId: string | null;
  onChange: () => void;
}) {

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = templates.find((t) => t.id === selectedId) ?? templates[0];
  const [draft, setDraft] = useState<{ id: string | null; name: string; body: string }>({
    id: null, name: "", body: DEFAULT_AGREEMENT_BODY,
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId || !wsId) throw new Error("No workspace found.");
      if (!draft.name.trim()) throw new Error("Give the template a name.");
      if (draft.id) {
        const { error } = await supabase
          .from("agreement_templates")
          .update({ name: draft.name, body: draft.body })
          .eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agreement_templates").insert({
          org_id: orgId,
          workspace_id: wsId,
          name: draft.name,
          body: draft.body,
          is_default: templates.length === 0,
        });
        if (error) throw error;
      }
    },

    onSuccess: () => {
      toast.success("Template Saved.");
      setEditorOpen(false);
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upload = async (file: File) => {
    if (!orgId || !wsId) return toast.error("No workspace found.");
    setUploading(true);
    try {
      const path = `${orgId}/templates/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("agreements").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;

      // Plain text uploads become editable bodies; binary files stay attached as-is.
      let body = "";
      if (/\.(txt|md)$/i.test(file.name) || file.type.startsWith("text/")) body = await file.text();

      const { error } = await supabase.from("agreement_templates").insert({
        org_id: orgId,
        workspace_id: wsId,
        name: file.name.replace(/\.[^.]+$/, ""),
        body,
        file_path: path,
        file_name: file.name,
        file_mime: file.type || null,
        is_default: templates.length === 0,
      });
      if (error) throw error;
      toast.success("Template Uploaded.");
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const makeDefault = async (id: string) => {
    if (!wsId) return;
    await supabase.from("agreement_templates").update({ is_default: false }).eq("workspace_id", wsId);
    const { error } = await supabase.from("agreement_templates").update({ is_default: true }).eq("id", id);

    if (error) return toast.error(error.message);
    toast.success("Default Template Set.");
    onChange();
  };

  const remove = async (row: any) => {
    if (row.file_path) await supabase.storage.from("agreements").remove([row.file_path]);
    const { error } = await supabase.from("agreement_templates").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Template Removed.");
    onChange();
  };

  const download = async (row: any) => {
    const { data, error } = await supabase.storage.from("agreements").createSignedUrl(row.file_path, 300);
    if (error || !data) return toast.error(error?.message ?? "Could not open the file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const insertToken = (token: string) => {
    const el = bodyRef.current;
    if (!el) return setDraft((d) => ({ ...d, body: d.body + token }));
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    setDraft((d) => ({ ...d, body: d.body.slice(0, start) + token + d.body.slice(end) }));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Template Library</h3>
          <div className="flex gap-1">
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <Button size="sm" variant="outline" className="rounded-xl" disabled={uploading}
              onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-[#111318] hover:bg-black"
              onClick={() => {
                setDraft({ id: null, name: "", body: DEFAULT_AGREEMENT_BODY });
                setEditorOpen(true);
              }}
            >
              <FilePlus2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-[#6B6B76]">
            No templates yet. Upload a PDF or DOCX, or write one with merge tokens.
          </p>
        ) : (
          <div className="space-y-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={
                  "w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 " +
                  (active?.id === t.id ? "bg-[#F5F5F8]" : "hover:bg-[#FAFAFC]")
                }
              >
                <FileText className="h-4 w-4 text-[#CC0000]" />
                <span className="flex-1 truncate text-sm font-medium">{t.name}</span>
                {t.is_default && <Badge variant="secondary" className="text-[10px]">DEFAULT</Badge>}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
        {!active ? (
          <EmptyState icon={FileText} title="Select A Template" hint="Or create your first one." />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-display text-xl font-semibold">{active.name}</h3>
                <p className="text-xs text-[#6B6B76] mt-1">
                  {active.file_name ? `Attached file: ${active.file_name}` : "Text template with merge tokens"}
                </p>
              </div>
              <div className="flex gap-2">
                {active.file_path && (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => download(active)}>
                    <Download className="h-4 w-4 mr-1" /> Open
                  </Button>
                )}
                {!active.is_default && (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => makeDefault(active.id)}>
                    <Star className="h-4 w-4 mr-1" /> Default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setDraft({ id: active.id, name: active.name, body: active.body || DEFAULT_AGREEMENT_BODY });
                    setEditorOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-[#CC0000]" onClick={() => remove(active)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-6 bg-[#FAFAFC] rounded-xl p-4 border border-[#EDEDF1] max-h-[520px] overflow-auto">
              {active.body || "This template is a file attachment. Open it to review the contents."}
            </pre>
          </>
        )}
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>Merge Tokens</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {MERGE_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    className="tab"
                    style={{ fontSize: 11 }}
                    onClick={() => insertToken(t.token)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                ref={bodyRef}
                rows={16}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------------- Compose ---------------------------------- */

function ComposeDialog({
  open, onClose, templates, leads, orgId, repName, onDone,
}: {
  open: boolean;
  onClose: () => void;
  templates: any[];
  leads: any[];
  orgId: string | null;
  repName: string;
  onDone: () => void;
}) {
  const [templateId, setTemplateId] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("2500");
  const [deposit, setDeposit] = useState("1250");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [body, setBody] = useState("");
  const [step, setStep] = useState<"setup" | "review">("setup");

  const template = templates.find((t) => t.id === templateId) ?? templates.find((t) => t.is_default) ?? templates[0];
  const lead = leads.find((l) => l.id === leadId);

  const buildBody = () =>
    applyMerge(template?.body || DEFAULT_AGREEMENT_BODY, {
      lead_name: signerName || lead?.name || "",
      company: lead?.company || "",
      email: signerEmail || lead?.email || "",
      phone: lead?.phone || "",
      amount: Number(amount || 0).toLocaleString(),
      deposit: Number(deposit || 0).toLocaleString(),
      currency: "USD",
      rep_name: repName,
      org_name: "Master Closer",
      date: new Date().toLocaleDateString(),
    });

  const create = useMutation({
    mutationFn: async (send: boolean) => {
      if (!orgId) throw new Error("No workspace found.");
      const { data: prof } = await supabase.from("profiles").select("active_workspace_id").maybeSingle();
      if (!prof?.active_workspace_id) throw new Error("No active workspace");
      if (!signerName.trim() || !signerEmail.trim()) throw new Error("Signer name and email are required.");
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("agreements")
        .insert({
          org_id: orgId,
          workspace_id: prof.active_workspace_id,
          template_id: template?.id ?? null,
          lead_id: leadId || null,
          title: title.trim() || `${signerName} — Agreement`,
          body,
          file_path: template?.file_path ?? null,
          file_name: template?.file_name ?? null,
          amount: Number(amount || 0),
          currency: "USD",
          status: send ? "sent" : "draft",
          sent_at: send ? new Date().toISOString() : null,
          signer_name: signerName,
          signer_email: signerEmail,
          created_by: auth.user?.id ?? null,
        })
        .select("id, token")
        .single();
      if (error) throw error;

      await supabase.from("agreement_events").insert({
        agreement_id: data.id,
        org_id: orgId,
        event_type: send ? "sent" : "created",
        meta: { to: signerEmail },
      });
      if (send) {
        void logActivity("agreement.sent", {
          agreement_id: data.id,
          signer_email: signerEmail,
          amount: Number(amount || 0),
        });
      }
      return data;
    },

    onSuccess: async (data, send) => {
      if (send) {
        await navigator.clipboard.writeText(signingUrl(data.token)).catch(() => {});
        toast.success("Agreement Sent. Signing link copied to your clipboard.");
      } else {
        toast.success("Draft Saved.");
      }
      setStep("setup");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{step === "setup" ? "New Agreement" : "Review & Send"}</DialogTitle>
        </DialogHeader>

        {step === "setup" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Template</Label>
              <Select value={template?.id ?? ""} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.is_default ? " · default" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Lead</Label>
              <Select
                value={leadId}
                onValueChange={(v) => {
                  setLeadId(v);
                  const l = leads.find((x) => x.id === v);
                  if (l) {
                    setSignerName(l.name ?? "");
                    setSignerEmail(l.email ?? "");
                    setTitle(`${l.name} — Agreement`);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Link a lead (optional)" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.company ? ` · ${l.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Growth Program — Agreement" />
            </div>
            <div>
              <Label>Signer Name</Label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
            </div>
            <div>
              <Label>Signer Email</Label>
              <Input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} />
            </div>
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Deposit (USD)</Label>
              <Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
          </div>
        ) : (
          <div>
            {remainingTokens(body).length > 0 && (
              <p className="text-xs text-[#B45309] mb-2">
                Unfilled tokens: {remainingTokens(body).join(", ")}
              </p>
            )}
            <Textarea rows={18} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
            {template?.file_name && (
              <p className="text-xs text-[#6B6B76] mt-2">
                Attached file travels with this agreement: {template.file_name}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "setup" ? (
            <Button
              className="bg-[#111318] hover:bg-black rounded-xl"
              onClick={() => {
                if (!signerName.trim() || !signerEmail.trim()) return toast.error("Signer name and email are required.");
                setBody(buildBody());
                setStep("review");
              }}
            >
              Fill & Preview
            </Button>
          ) : (
            <>
              <Button variant="outline" className="rounded-xl" onClick={() => setStep("setup")}>Back</Button>
              <Button variant="outline" className="rounded-xl" disabled={create.isPending}
                onClick={() => create.mutate(false)}>
                Save Draft
              </Button>
              <Button
                className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
                disabled={create.isPending}
                onClick={() => create.mutate(true)}
              >
                <Send className="h-4 w-4 mr-1" /> Send For Signature
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- Detail ---------------------------------- */

function AgreementDrawer({
  agreement, onClose, onChange,
}: {
  agreement: any | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const { data: events } = useQuery({
    queryKey: ["agreement_events", agreement?.id],
    enabled: !!agreement,
    queryFn: async () => {
      const { data } = await supabase
        .from("agreement_events")
        .select("*")
        .eq("agreement_id", agreement.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!agreement) return null;
  const link = signingUrl(agreement.token);

  const send = async () => {
    const { error } = await supabase
      .from("agreements")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", agreement.id);
    if (error) return toast.error(error.message);
    await supabase.from("agreement_events").insert({
      agreement_id: agreement.id,
      org_id: agreement.org_id,
      event_type: "sent",
      meta: { to: agreement.signer_email },
    });
    void logActivity("agreement.sent", {
      agreement_id: agreement.id,
      signer_email: agreement.signer_email,
      amount: Number(agreement.amount ?? 0),
    });
    await navigator.clipboard.writeText(link).catch(() => {});

    toast.success("Sent. Signing link copied.");
    onChange();
    onClose();
  };

  const voidIt = async () => {
    const { error } = await supabase.from("agreements").update({ status: "void" }).eq("id", agreement.id);
    if (error) return toast.error(error.message);
    await supabase.from("agreement_events").insert({
      agreement_id: agreement.id,
      org_id: agreement.org_id,
      event_type: "voided",
      meta: {},
    });
    toast.success("Agreement Voided.");
    onChange();
    onClose();
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">{agreement.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <StatusPill
              label={String(agreement.status).toUpperCase()}
              tone={STATUS_TONE[agreement.status as AgreementStatus] ?? "neutral"}
            />
            <span className="text-sm font-num">{money(Number(agreement.amount ?? 0), agreement.currency)}</span>
          </div>

          <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none">
            <Label className="text-xs">Signing Link</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={link} className="text-xs" />
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  navigator.clipboard.writeText(link).catch(() => {});
                  toast.success("Link Copied.");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {agreement.status === "draft" && (
                <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl" onClick={send}>
                  <Send className="h-4 w-4 mr-1" /> Send For Signature
                </Button>
              )}
              {agreement.status !== "void" && agreement.status !== "signed" && (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    emailSigningLink({
                      to: agreement.signer_email,
                      title: agreement.title,
                      link,
                      amount: Number(agreement.amount ?? 0),
                      currency: agreement.currency,
                    })
                  }
                >
                  <Mail className="h-4 w-4 mr-1" /> Email Link
                </Button>
              )}
              <Button variant="outline" className="rounded-xl" onClick={() => window.open(link, "_blank", "noopener")}>
                <Eye className="h-4 w-4 mr-1" /> Preview As Signer
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  const ok = printSignedCopy({
                    title: agreement.title,
                    body: agreement.body,
                    amount: Number(agreement.amount ?? 0),
                    currency: agreement.currency,
                    signerName: agreement.signer_name,
                    signerEmail: agreement.signer_email,
                    signedAt: agreement.signed_at,
                    signatureType: agreement.signature_type,
                    signatureData: agreement.signature_data,
                    signerIp: agreement.signer_ip,
                  });
                  if (!ok) toast.error("Allow pop-ups to download the PDF copy.");
                }}
              >
                <Printer className="h-4 w-4 mr-1" />
                {agreement.status === "signed" ? "Download Signed PDF" : "Download PDF"}
              </Button>
              {agreement.status !== "signed" && agreement.status !== "void" && (
                <Button variant="ghost" className="text-[#CC0000]" onClick={voidIt}>Void</Button>
              )}
            </div>
          </Card>

          {agreement.status === "signed" && (
            <Card className="p-4 rounded-2xl border-[#0E9F6E]/30 bg-[#E6F6EE] shadow-none">
              <div className="text-sm font-semibold text-[#0E7A55]">
                Signed by {agreement.signer_name} on {new Date(agreement.signed_at).toLocaleString()}
              </div>
              {agreement.signature_type === "drawn" ? (
                <img src={agreement.signature_data} alt="Signature" className="h-16 mt-2 bg-white rounded" />
              ) : (
                <div className="mt-2 text-2xl" style={{ fontFamily: "cursive" }}>{agreement.signature_data}</div>
              )}
              <div className="text-xs text-[#4A6B5C] mt-2">IP recorded: {agreement.signer_ip ?? "n/a"}</div>
            </Card>
          )}


          <div>
            <Label className="text-xs">Document</Label>
            <pre className="whitespace-pre-wrap text-xs leading-6 bg-[#FAFAFC] rounded-xl p-4 border border-[#EDEDF1] mt-1 max-h-[320px] overflow-auto">
              {agreement.body}
            </pre>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><History className="h-3 w-3" /> Audit Trail</Label>
            <div className="mt-2 space-y-2">
              {(events ?? []).map((e: any) => (
                <div key={e.id} className="flex items-center justify-between text-xs border-b border-[#F3F3F6] pb-2">
                  <span className="font-medium capitalize">{e.event_type}</span>
                  <span className="text-[#6B6B76]">{new Date(e.created_at).toLocaleString()}</span>
                </div>
              ))}
              {(events ?? []).length === 0 && <p className="text-xs text-[#6B6B76]">No events yet.</p>}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
