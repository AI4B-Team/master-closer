import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyState } from "@/components/back-office/ui";
import { Plus, BookOpen, MessageSquareQuote, Trash2, Sparkles } from "lucide-react";
import { suggestObjections } from "@/lib/agents.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Suggestion = { trigger: string; category?: string | null; response: string };


export const Route = createFileRoute("/_authenticated/playbook")({
  head: () => ({
    meta: [
      { title: "Playbook — Master Closer" },
      { name: "description", content: "Scripts, objections, and exact closing lines your AI Closers draw from." },
      { property: "og:title", content: "Playbook — Master Closer" },
      { property: "og:description", content: "Scripts, objections, and exact closing lines your AI Closers draw from." },
    ],
  }),
  component: PlaybookPage,
});

async function orgId() {
  const { data } = await supabase.from("profiles").select("org_id").maybeSingle();
  if (!data) throw new Error("No workspace found.");
  return data.org_id;
}

function PlaybookPage() {
  return (
    <div>
      <PageHeader
        title="AI Agents"
        description="Playbook — the library your AI Closers draw from: scripts, objections, exact lines."
        tabs={TAB_GROUPS.studio}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Scripts />
        <Objections />
      </div>
    </div>
  );
}

function Scripts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", content: "" });

  const { data: scripts } = useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data } = await supabase.from("playbooks").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("playbooks").update({ ...form }).eq("id", editId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("playbooks").insert({ ...form, org_id: await orgId() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Script Updated." : "Script Saved.");
      setOpen(false);
      setEditId(null);
      setForm({ name: "", description: "", content: "" });
      qc.invalidateQueries({ queryKey: ["playbooks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playbooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbooks"] }),
  });

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-[#CC0000]" />
          </div>
          <div>
            <h3 className="font-semibold">Scripts</h3>
            <p className="text-sm text-[#6B6B76]">Openers, discovery frames, and closing sequences.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
              <Plus className="h-4 w-4 mr-1" /> New Script
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Script</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Discovery Opener" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="When to use it" />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea rows={7} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="The exact words." />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={!form.name.trim() || create.isPending}
                className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              >
                Save Script
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!scripts || scripts.length === 0 ? (
        <EmptyState icon={BookOpen} title="No Scripts Yet" hint="Add the lines your closers should always have ready." />
      ) : (
        <div className="space-y-2">
          {scripts.map((s: any) => (
            <div key={s.id} className="border border-[#E7E7EC] rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{s.name}</p>
                  {s.description && <p className="text-xs text-[#6B6B76] mt-0.5">{s.description}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove.mutate(s.id)}>
                  <Trash2 className="h-4 w-4 text-[#6B6B76]" />
                </Button>
              </div>
              {s.content && (
                <p className="text-sm text-[#4A505C] mt-2 whitespace-pre-line">{s.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Objections() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ trigger: "", response: "", category: "" });
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ industry: "", focus: "" });
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});


  const { data: objections } = useQuery({
    queryKey: ["objections"],
    queryFn: async () => {
      const { data } = await supabase.from("objections").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Live usage: which library objections actually surfaced on calls, and how often the rep said the line.
  const { data: usage } = useQuery({
    queryKey: ["objection-usage"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suggestions")
        .select("objection, was_used")
        .order("ts_sec", { ascending: false })
        .limit(1000);
      return data ?? [];
    },
  });

  const statsFor = (trigger: string) => {
    const key = String(trigger).toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    if (!key || !usage) return { surfaced: 0, used: 0 };
    const words = key.split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
    const rows = usage.filter((r: any) => {
      const o = String(r.objection ?? "").toLowerCase();
      if (!o) return false;
      if (o.includes(key) || key.includes(o)) return true;
      return words.length > 0 && words.every((w) => o.includes(w));
    });
    return { surfaced: rows.length, used: rows.filter((r: any) => r.was_used).length };
  };


  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("objections").insert({
        trigger: form.trigger,
        response: form.response,
        category: form.category || null,
        org_id: await orgId(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Objection Saved.");
      setOpen(false);
      setForm({ trigger: "", response: "", category: "" });
      qc.invalidateQueries({ queryKey: ["objections"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const res = await suggestObjections({
        data: {
          industry: gen.industry || null,
          focus: gen.focus || null,
          existing: (objections ?? []).map((o: any) => String(o.trigger)).slice(0, 50),
        },
      });
      setSuggestions(res.items);
      setPicked({});
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate objections.");
    } finally {
      setGenerating(false);
    }
  };

  const saveMany = useMutation({
    mutationFn: async () => {
      const chosen = suggestions.filter((_, i) => picked[i] ?? true);
      if (chosen.length === 0) return 0;
      const org = await orgId();
      const { error } = await supabase.from("objections").insert(
        chosen.map((s) => ({
          trigger: s.trigger,
          response: s.response,
          category: s.category || null,
          org_id: org,
        })),
      );
      if (error) throw error;
      return chosen.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} Objection${count === 1 ? "" : "s"} Added.`);
      setGenOpen(false);
      setSuggestions([]);
      setPicked({});
      qc.invalidateQueries({ queryKey: ["objections"] });
    },
    onError: (e: any) => toast.error(e.message),
  });



  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("objections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["objections"] }),
  });

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
            <MessageSquareQuote className="h-5 w-5 text-[#CC0000]" />
          </div>
          <div>
            <h3 className="font-semibold">Objections</h3>
            <p className="text-sm text-[#6B6B76]">Trigger phrase in, exact response out.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setGenOpen(true)}>
          <Sparkles className="h-4 w-4 mr-1 text-[#CC0000]" /> Generate With AI
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>

          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-xl">
              <Plus className="h-4 w-4 mr-1" /> New Objection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Objection</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Trigger</Label>
                <Input value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} placeholder="Your competitor is cheaper." />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Price" />
              </div>
              <div>
                <Label>Response</Label>
                <Textarea rows={5} value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} placeholder="Say this now." />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={!form.trigger.trim() || !form.response.trim() || create.isPending}
                className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              >
                Save Objection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Generate Objections With AI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Industry</Label>
                <Input value={gen.industry} onChange={(e) => setGen({ ...gen, industry: e.target.value })} placeholder="Home Services" />
              </div>
              <div>
                <Label>Focus (Optional)</Label>
                <Input value={gen.focus} onChange={(e) => setGen({ ...gen, focus: e.target.value })} placeholder="Price And Competitors" />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={generating}
              onClick={runGenerate}
            >
              <Sparkles className="h-4 w-4 mr-1 text-[#CC0000]" />
              {generating ? "Writing Objections…" : suggestions.length ? "Regenerate" : "Generate"}
            </Button>

            {suggestions.length > 0 && (
              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {suggestions.map((s, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setPicked((p) => ({ ...p, [i]: !(p[i] ?? true) }))}
                    className={`w-full text-left border rounded-xl px-4 py-3 transition-colors ${
                      (picked[i] ?? true) ? "border-[#CC0000] bg-[#CC0000]/5" : "border-[#E7E7EC]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-sm">“{s.trigger}”</p>
                      {s.category && <Badge variant="secondary" className="shrink-0">{s.category}</Badge>}
                    </div>
                    <p className="text-sm text-[#4A505C] mt-1">{s.response}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              disabled={!suggestions.some((_, i) => picked[i] ?? true) || saveMany.isPending}
              onClick={() => saveMany.mutate()}
            >
              Add Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {!objections || objections.length === 0 ? (
        <EmptyState icon={MessageSquareQuote} title="No Objections Yet" hint="Load the pushback your reps hear most." />
      ) : (
        <div className="space-y-2">
          {objections.map((o: any) => (
            <div key={o.id} className="border border-[#E7E7EC] rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">“{o.trigger}”</p>
                  <p className="text-sm text-[#4A505C] mt-1">{o.response}</p>
                  {(() => {
                    const s = statsFor(o.trigger);
                    if (!s.surfaced) return null;
                    const rate = Math.round((s.used / s.surfaced) * 100);
                    return (
                      <p className="text-xs text-[#6B6B76] mt-2">
                        Surfaced On {s.surfaced} {s.surfaced === 1 ? "Call" : "Calls"} · Delivered {s.used} ·{" "}
                        <span style={{ color: rate >= 60 ? "#0F9D58" : rate >= 30 ? "#B26B00" : "#CC0000", fontWeight: 600 }}>
                          {rate}% Use Rate
                        </span>
                      </p>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {o.category && <Badge variant="secondary">{o.category}</Badge>}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove.mutate(o.id)}>
                    <Trash2 className="h-4 w-4 text-[#6B6B76]" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
