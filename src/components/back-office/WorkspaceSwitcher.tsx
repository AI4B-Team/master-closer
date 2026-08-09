import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createWorkspace } from "@/lib/workspaces.functions";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";

type WsRow = { id: string; name: string; slug: string; brand_color: string };

/**
 * Top-bar workspace picker. Every data query in the back office is scoped to
 * profiles.active_workspace_id, so switching here re-scopes the whole app.
 */
export function WorkspaceSwitcher() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const makeWorkspace = useServerFn(createWorkspace);
  const { data: active } = useWorkspace();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const { data: workspaces } = useQuery({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, workspaces:workspace_id(id, name, slug, brand_color)")
        .limit(50);
      if (error) throw error;
      return (data ?? [])
        .map((m: any) => m.workspaces as WsRow | null)
        .filter(Boolean) as WsRow[];
    },
  });

  const switchTo = useMutation({
    mutationFn: async (id: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { error } = await supabase.from("profiles").update({ active_workspace_id: id }).eq("id", uid);
      if (error) throw error;
    },
    onSuccess: async () => {
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["active-workspace"] });
      await qc.invalidateQueries();
      toast.success("Workspace Switched");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not switch workspace."),
  });

  const create = useMutation({
    mutationFn: () => makeWorkspace({ data: { name: newName.trim() } }),
    onSuccess: async () => {
      setCreating(false);
      setNewName("");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["my-workspaces"] });
      await qc.invalidateQueries({ queryKey: ["active-workspace"] });
      await qc.invalidateQueries();
      toast.success("Workspace Created");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the workspace."),
  });

  const list = workspaces ?? [];
  if (list.length < 2 && !active) return null;

  return (
    <div className="ws-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ws-btn has-tip tip-below"
        data-tip="Switch Workspace"
        aria-label="Switch Workspace"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ws-dot" style={{ background: active?.brand_color || "#CC0000" }} />
        <span className="ws-name">{active?.name ?? "Workspace"}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="ws-menu">
          <div className="ws-menu-h">Your Workspaces</div>
          {list.length === 0 ? (
            <div className="ws-empty">No Workspaces Yet</div>
          ) : (
            list.map((w) => {
              const isActive = w.id === active?.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  className={"ws-item " + (isActive ? "ws-item-active" : "")}
                  onClick={() => (isActive ? setOpen(false) : switchTo.mutate(w.id))}
                  disabled={switchTo.isPending}
                >
                  <span className="ws-dot" style={{ background: w.brand_color || "#CC0000" }} />
                  <span className="ws-item-t">
                    <span className="ws-item-name">{w.name}</span>
                    <span className="ws-item-slug">{w.slug}</span>
                  </span>
                  {isActive ? <Check size={14} className="text-[#CC0000]" /> : <Building2 size={14} className="opacity-40" />}
                </button>
              );
            })
          )}

          <div className="ws-sep" />
          {creating ? (
            <form
              className="ws-create"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim().length >= 2) create.mutate();
              }}
            >
              <input
                className="ws-input"
                placeholder="Workspace Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="ws-create-btn" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create"}
              </button>
            </form>
          ) : (
            <button type="button" className="ws-item" onClick={() => setCreating(true)}>
              <Plus size={14} className="text-[#CC0000]" />
              <span className="ws-item-name">New Workspace</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
