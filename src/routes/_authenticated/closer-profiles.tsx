import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, Panel, SkeletonRows, StatusPill } from "@/components/back-office/ui";
import { ObjectionReviewQueue } from "@/components/back-office/ObjectionReviewQueue";
import {
  Plus, Copy, Eye, Trash2, Save, Sparkles, Link2, Layers, ShieldAlert, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORICAL_ESCALATION, INDUSTRIES, LEAD_SOURCES, PLATFORM_GUARDRAILS,
  industryLabel, sourceLabel, type Industry, type Objection,
} from "@/lib/closer-profiles";
import {
  deleteCloserProfile, draftProfileFromUrl, duplicateCloserProfile, listCloserProfiles,
  previewAssembledPrompt, saveCloserProfile,
} from "@/lib/closer-profiles.functions";

export const Route = createFileRoute("/_authenticated/closer-profiles")({
  head: () => ({
    meta: [
      { title: "Closer Profiles — Master Closer" },
      {
        name: "description",
        content:
          "One engine, many industries. Each vertical gets its own opener, objections, screening and escalation list, resolved per lead.",
      },
      { property: "og:title", content: "Closer Profiles — Master Closer" },
      {
        property: "og:description",
        content: "Per-industry personas with platform guardrails that a profile can only make stricter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CloserProfilesPage,
});

type Row = {
  id: string;
  workspace_id: string | null;
  industry: string | null;
  source: string | null;
  name: string;
  is_default: boolean;
  opener: string;
  context_framing: string | null;
  objections: Objection[];
  screening_questions: string[];
  faqs: string[];
  tone: string | null;
  escalation_triggers: string[];
  banned_topics: string[];
  dispositions: string[];
};

type Draft = {
  id?: string | null;
  industry: string;
  source: string;
  name: string;
  is_default: boolean;
  opener: string;
  context_framing: string;
  tone: string;
  objections: Objection[];
  screening_questions: string[];
  faqs: string[];
  escalation_triggers: string[];
  banned_topics: string[];
  dispositions: string[];
};

const ANY_SOURCE = "__any__";

function emptyDraft(industry = "saas"): Draft {
  return {
    id: null, industry, source: ANY_SOURCE, name: "", is_default: false, opener: "",
    context_framing: "", tone: "", objections: [], screening_questions: [], faqs: [],
    escalation_triggers: [], banned_topics: [], dispositions: [],
  };
}

function toDraft(row: Row): Draft {
  return {
    id: row.workspace_id ? row.id : null,
    industry: row.industry ?? "saas",
    source: row.source ?? ANY_SOURCE,
    name: row.workspace_id ? row.name : `${row.name} (Copy)`,
    is_default: row.is_default,
    opener: row.opener,
    context_framing: row.context_framing ?? "",
    tone: row.tone ?? "",
    objections: Array.isArray(row.objections) ? row.objections : [],
    screening_questions: row.screening_questions ?? [],
    faqs: row.faqs ?? [],
    escalation_triggers: row.escalation_triggers ?? [],
    banned_topics: row.banned_topics ?? [],
    dispositions: row.dispositions ?? [],
  };
}

/** Small editor for a string[] field rendered as removable chips. */
function ListField({
  label, hint, values, onChange, placeholder,
}: {
  label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (!v) return;
    onChange([...values, v]);
    setText("");
  };
  return (
    <div>
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-[#6B6B76] mb-1">{hint}</p> : null}
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v, i) => (
          <Badge key={`${v}-${i}`} variant="outline" className="gap-1 max-w-full">
            <span className="truncate">{v}</span>
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

function CloserProfilesPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listCloserProfiles);
  const save = useServerFn(saveCloserProfile);
  const remove = useServerFn(deleteCloserProfile);
  const duplicate = useServerFn(duplicateCloserProfile);
  const preview = useServerFn(previewAssembledPrompt);
  const trainUrl = useServerFn(draftProfileFromUrl);

  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [dupFor, setDupFor] = useState<Row | null>(null);
  const [dupIndustry, setDupIndustry] = useState<string>("solar");
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainForm, setTrainForm] = useState({ url: "", industry: "saas" });
  const [trainBaseline, setTrainBaseline] = useState<Row | null>(null);

  const q = useQuery({ queryKey: ["closer-profiles"], queryFn: () => fetchAll({}) });
  const mine = (q.data?.profiles ?? []) as unknown as Row[];
  const platform = (q.data?.platform ?? []) as unknown as Row[];

  const grouped = useMemo(() => {
    const keys = industryFilter === "all" ? INDUSTRIES.map((i) => i.key) : [industryFilter as Industry];
    return keys.map((key) => ({
      key,
      workspace: mine.filter((p) => p.industry === key),
      platform: platform.filter((p) => p.industry === key),
    }));
  }, [mine, platform, industryFilter]);

  const wsDefault = mine.find((p) => p.is_default) ?? null;

  const saveMut = useMutation({
    mutationFn: (draft: Draft) =>
      save({
        data: {
          id: draft.id ?? null,
          industry: draft.industry,
          source: draft.source === ANY_SOURCE ? null : draft.source,
          name: draft.name,
          is_default: draft.is_default,
          opener: draft.opener,
          context_framing: draft.context_framing || null,
          tone: draft.tone || null,
          objections: draft.objections.filter((o) => o.trigger && o.approved_response),
          screening_questions: draft.screening_questions,
          faqs: draft.faqs,
          escalation_triggers: draft.escalation_triggers,
          banned_topics: draft.banned_topics,
          dispositions: draft.dispositions,
        },
      }),
    onSuccess: () => {
      toast.success("Closer profile saved.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["closer-profiles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Profile removed.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["closer-profiles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dupMut = useMutation({
    mutationFn: (input: { sourceId: string; industry: string; name: string }) =>
      duplicate({ data: { ...input, source: null } }),
    onSuccess: () => {
      toast.success("Duplicated into this workspace.");
      setDupFor(null);
      qc.invalidateQueries({ queryKey: ["closer-profiles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const previewMut = useMutation({
    mutationFn: (id: string) => preview({ data: { profileId: id, mode: "hybrid" } }),
    onSuccess: (r) => setPreviewText(r.prompt),
    onError: (e: any) => toast.error(e.message),
  });

  const trainMut = useMutation({
    mutationFn: () => trainUrl({ data: { url: trainForm.url.trim(), industry: trainForm.industry } }),
    onSuccess: (r) => {
      const base = platform.find((p) => p.industry === trainForm.industry) ?? null;
      setTrainBaseline(base);
      setTrainOpen(false);
      setEditing({
        ...emptyDraft(trainForm.industry),
        name: r.draft.name,
        opener: r.draft.opener,
        context_framing: r.draft.context_framing ?? "",
        tone: r.draft.tone ?? "",
        objections: r.draft.objections,
        screening_questions: r.draft.screening_questions,
        faqs: r.draft.faqs,
        escalation_triggers: base?.escalation_triggers ?? [],
        banned_topics: base?.banned_topics ?? [],
        dispositions: base?.dispositions ?? [],
      });
      toast.success("Draft ready for review. Nothing goes live until you save it.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Closer Profiles"
        description="One engine, many industries. A profile changes what the AI says, never which brand or number it says it from."
        tabs={TAB_GROUPS.studio}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setTrainOpen(true)}>
              <Link2 className="h-4 w-4 mr-1" /> Train From URL
            </Button>
            <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl" onClick={() => setEditing(emptyDraft())}>
              <Plus className="h-4 w-4 mr-1" /> New Profile
            </Button>
          </div>
        }
      />

      <ObjectionReviewQueue
        profiles={mine.map((p) => ({ id: p.id, name: p.name, industry: p.industry }))}
      />

      <Panel title="Always On" className="mb-4">
        <p className="text-sm text-[#6B6B76]">
          Platform guardrails, the handoff patterns and the banned-output filter run on every call and cannot be
          relaxed by a profile. A profile's escalation triggers and never-discuss topics are additive only — they can
          make a closer more cautious, never less.
        </p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-[#F6F6F8] p-3 text-xs whitespace-pre-wrap text-[#3A3A44]">
          {PLATFORM_GUARDRAILS}
        </pre>
      </Panel>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setIndustryFilter("all")}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            industryFilter === "all"
              ? "border-[#CC0000] text-[#CC0000] bg-[#CC0000]/5"
              : "border-[#E7E7EC] text-[#6B6B76] hover:border-[#CC0000]/40"
          }`}
        >
          All Industries
        </button>
        {INDUSTRIES.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={() => setIndustryFilter(i.key)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              industryFilter === i.key
                ? "border-[#CC0000] text-[#CC0000] bg-[#CC0000]/5"
                : "border-[#E7E7EC] text-[#6B6B76] hover:border-[#CC0000]/40"
            }`}
          >
            {i.label}
          </button>
        ))}
        {wsDefault ? (
          <span className="ml-auto text-xs text-[#6B6B76]">
            Workspace default: <strong className="text-[#111114]">{wsDefault.name}</strong>
          </span>
        ) : (
          <span className="ml-auto text-xs text-[#CC0000]">
            No workspace default set — leads without a matching industry fall to the platform profile.
          </span>
        )}
      </div>

      {q.isLoading ? (
        <Panel title="Profiles"><SkeletonRows rows={6} /></Panel>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <Panel key={group.key} title={industryLabel(group.key)}>
              <div className="space-y-2">
                {[...group.workspace, ...group.platform].length === 0 ? (
                  <p className="text-sm text-[#6B6B76]">Nothing configured for this industry yet.</p>
                ) : null}

                {group.workspace.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E7E7EC] p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#111114] truncate">{p.name}</span>
                        <StatusPill label={sourceLabel(p.source)} tone="neutral" />
                        {p.is_default ? <StatusPill label="Workspace Default" tone="green" /> : null}
                      </div>
                      <p className="mt-1 text-xs text-[#6B6B76] line-clamp-2">{p.opener}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => previewMut.mutate(p.id)}>
                        <Eye className="h-4 w-4 mr-1" /> Prompt
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setDupFor(p); setDupIndustry(p.industry ?? "solar"); }}>
                        <Copy className="h-4 w-4 mr-1" /> Duplicate
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(toDraft(p))}>Edit</Button>
                    </div>
                  </div>
                ))}

                {group.platform.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#E7E7EC] bg-[#FAFAFB] p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#111114] truncate">{p.name}</span>
                        <StatusPill label="Platform Default" tone="neutral" />
                        <span className="text-xs text-[#6B6B76]">{p.objections.length} Objections</span>
                      </div>
                      <p className="mt-1 text-xs text-[#6B6B76] line-clamp-2">{p.opener}</p>
                      {(CATEGORICAL_ESCALATION[p.industry as Industry] ?? []).length ? (
                        <p className="mt-1 flex items-start gap-1 text-xs text-[#6B6B76]">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#CC0000]" />
                          Always hands off: {(CATEGORICAL_ESCALATION[p.industry as Industry] ?? []).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => previewMut.mutate(p.id)}>
                        <Eye className="h-4 w-4 mr-1" /> Prompt
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(toDraft(p))}>
                        <Copy className="h-4 w-4 mr-1" /> Customize
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
          {grouped.length === 0 ? (
            <EmptyPanel icon={Layers} title="No Profiles" hint="Create a profile to get started." />
          ) : null}
        </div>
      )}

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setTrainBaseline(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Closer Profile" : "New Closer Profile"}</DialogTitle>
            <DialogDescription>
              Persona only. Sending identity — legal name, caller ID and brand — stays a workspace setting.
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <div className="space-y-4">
              {trainBaseline ? (
                <div className="rounded-xl border border-[#E7E7EC] bg-[#FAFAFB] p-3">
                  <p className="text-xs uppercase tracking-wider text-[#6B6B76] mb-1">
                    Drafted From URL · Pending Your Approval
                  </p>
                  <p className="text-xs text-[#6B6B76]">
                    Seeded platform opener for comparison: <span className="text-[#111114]">{trainBaseline.opener}</span>
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Solar Closer — Inbound" />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Select value={editing.industry} onValueChange={(v) => setEditing({ ...editing, industry: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Source Scope</Label>
                  <Select value={editing.source} onValueChange={(v) => setEditing({ ...editing, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY_SOURCE}>Any Source</SelectItem>
                      {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{sourceLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Opener</Label>
                <Textarea rows={3} value={editing.opener} onChange={(e) => setEditing({ ...editing, opener: e.target.value })} />
              </div>
              <div>
                <Label>Context Framing</Label>
                <Textarea rows={2} value={editing.context_framing} onChange={(e) => setEditing({ ...editing, context_framing: e.target.value })} placeholder="How the closer explains why it is reaching out." />
              </div>
              <div>
                <Label>Tone</Label>
                <Input value={editing.tone} onChange={(e) => setEditing({ ...editing, tone: e.target.value })} placeholder="Direct, warm, allergic to hype." />
              </div>

              <div>
                <Label>Objections</Label>
                <p className="text-xs text-[#6B6B76] mb-2">The prospect's words, and the approved words back.</p>
                <div className="space-y-2">
                  {editing.objections.map((o, i) => (
                    <div key={i} className="rounded-xl border border-[#E7E7EC] p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={o.trigger}
                          placeholder="They say…"
                          onChange={(e) => {
                            const next = [...editing.objections];
                            next[i] = { ...o, trigger: e.target.value };
                            setEditing({ ...editing, objections: next });
                          }}
                        />
                        <Button
                          type="button" variant="ghost" size="icon" aria-label="Remove objection"
                          onClick={() => setEditing({ ...editing, objections: editing.objections.filter((_, j) => j !== i) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        value={o.approved_response}
                        placeholder="Approved response…"
                        onChange={(e) => {
                          const next = [...editing.objections];
                          next[i] = { ...o, approved_response: e.target.value };
                          setEditing({ ...editing, objections: next });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button" variant="outline" className="mt-2"
                  onClick={() => setEditing({ ...editing, objections: [...editing.objections, { trigger: "", approved_response: "" }] })}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Objection
                </Button>
              </div>

              <ListField
                label="Screening Questions" values={editing.screening_questions}
                onChange={(v) => setEditing({ ...editing, screening_questions: v })}
                placeholder="What is your average monthly bill?"
              />
              <ListField
                label="Known Answers" values={editing.faqs}
                onChange={(v) => setEditing({ ...editing, faqs: v })}
                placeholder="How long does install take? Usually one day."
              />
              <ListField
                label="Extra Escalation Triggers"
                hint={`Additive. Platform patterns and ${industryLabel(editing.industry)} categorical escalation always apply.`}
                values={editing.escalation_triggers}
                onChange={(v) => setEditing({ ...editing, escalation_triggers: v })}
                placeholder="group plan"
              />
              <ListField
                label="Extra Never-Discuss Topics" hint="Additive only — a profile can never allow a banned topic."
                values={editing.banned_topics}
                onChange={(v) => setEditing({ ...editing, banned_topics: v })}
                placeholder="competitor pricing"
              />
              <ListField
                label="Dispositions" values={editing.dispositions}
                onChange={(v) => setEditing({ ...editing, dispositions: v })}
                placeholder="appointment_set"
              />

              <div className="flex items-center justify-between rounded-xl border border-[#E7E7EC] p-3">
                <div className="pr-3">
                  <p className="text-sm font-medium text-[#111114]">Workspace Default</p>
                  <p className="text-xs text-[#6B6B76]">Used when a lead's industry has no profile of its own.</p>
                </div>
                <Switch checked={editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-wrap gap-2">
            {editing?.id ? (
              <Button variant="ghost" className="text-[#CC0000] mr-auto" onClick={() => removeMut.mutate(editing.id!)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            ) : null}
            <Button
              className="bg-[#CC0000] hover:bg-[#A30000]"
              disabled={!editing?.name || !editing?.opener || saveMut.isPending}
              onClick={() => editing && saveMut.mutate(editing)}
            >
              <Save className="h-4 w-4 mr-1" /> Save Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate to another industry */}
      <Dialog open={!!dupFor} onOpenChange={(o) => !o && setDupFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Duplicate To New Industry</DialogTitle></DialogHeader>
          <DialogDescription>Copies the persona into this workspace under a different vertical.</DialogDescription>
          <div>
            <Label>Industry</Label>
            <Select value={dupIndustry} onValueChange={setDupIndustry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#CC0000] hover:bg-[#A30000]"
              disabled={dupMut.isPending}
              onClick={() =>
                dupFor &&
                dupMut.mutate({
                  sourceId: dupFor.id,
                  industry: dupIndustry,
                  name: `${industryLabel(dupIndustry)} Closer`,
                })
              }
            >
              <Copy className="h-4 w-4 mr-1" /> Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Train from URL */}
      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Train From URL</DialogTitle></DialogHeader>
          <DialogDescription>
            We read a public page and draft an opener, framing, FAQs and a starter objection set. The draft is a
            proposal you review and approve — it never goes live on its own.
          </DialogDescription>
          <div className="space-y-3">
            <div>
              <Label>Website Or Google Business Profile URL</Label>
              <Input value={trainForm.url} onChange={(e) => setTrainForm({ ...trainForm, url: e.target.value })} placeholder="https://example.com" />
            </div>
            <div>
              <Label>Industry</Label>
              <Select value={trainForm.industry} onValueChange={(v) => setTrainForm({ ...trainForm, industry: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#CC0000] hover:bg-[#A30000]"
              disabled={!trainForm.url.trim() || trainMut.isPending}
              onClick={() => trainMut.mutate()}
            >
              <Sparkles className="h-4 w-4 mr-1" /> {trainMut.isPending ? "Drafting…" : "Draft Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assembled prompt preview */}
      <Dialog open={!!previewText} onOpenChange={(o) => !o && setPreviewText(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assembled System Prompt</DialogTitle></DialogHeader>
          <DialogDescription>
            Compose order is fixed: platform guardrails, persona, lead record, then history. Record facts always win.
          </DialogDescription>
          <pre className="rounded-xl bg-[#F6F6F8] p-3 text-xs whitespace-pre-wrap text-[#3A3A44]">{previewText}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
