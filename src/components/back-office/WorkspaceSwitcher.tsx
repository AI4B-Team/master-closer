import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePrefs } from "@/hooks/use-prefs";
import {
  Building2,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
} from "@/lib/workspaces.functions";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";

type WsRole = "owner" | "admin" | "member";

type WsRow = {
  id: string;
  name: string;
  slug: string;
  brand_color: string;
  role: WsRole;
};

export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const makeWorkspace = useServerFn(createWorkspace);
  const renameWorkspaceFn = useServerFn(renameWorkspace);
  const deleteWorkspaceFn = useServerFn(deleteWorkspace);

  const { data: active } = useWorkspace();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Reset transient states when the menu closes.
  useEffect(() => {
    if (open) return;
    setCreating(false);
    setNewName("");
    setEditingId(null);
    setEditName("");
    setDeletingId(null);
    setDeleteConfirm("");
  }, [open]);

  const { data: workspaces } = useQuery({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select(
          "workspace_id, role, workspaces:workspace_id(id, name, slug, brand_color)",
        )
        .limit(50);
      if (error) throw error;
      return (data ?? [])
        .map((m: any) => ({
          ...(m.workspaces as Omit<WsRow, "role"> | null),
          role: (m.role as WsRole) ?? "member",
        }))
        .filter((w): w is WsRow => Boolean(w.id));
    },
  });

  const switchTo = useMutation({
    mutationFn: async (id: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { error } = await supabase
        .from("profiles")
        .update({ active_workspace_id: id })
        .eq("id", uid);
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

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      // Server function scopes to the *active* workspace, so we switch first —
      // then switch back so managing another workspace never moves the user.
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const previous = active?.id ?? null;
      await supabase.from("profiles").update({ active_workspace_id: id }).eq("id", uid);
      try {
        return await renameWorkspaceFn({ data: { name: name.trim() } });
      } finally {
        if (previous && previous !== id) {
          await supabase.from("profiles").update({ active_workspace_id: previous }).eq("id", uid);
        }
      }
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditName("");
      await qc.invalidateQueries({ queryKey: ["my-workspaces"] });
      await qc.invalidateQueries({ queryKey: ["active-workspace"] });
      toast.success("Workspace Renamed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not rename workspace."),
  });

  const remove = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const previous = active?.id ?? null;
      await supabase.from("profiles").update({ active_workspace_id: id }).eq("id", uid);
      try {
        return await deleteWorkspaceFn({ data: { confirmName: name } });
      } finally {
        // Deleting a workspace the user wasn't in shouldn't relocate them.
        if (previous && previous !== id) {
          await supabase.from("profiles").update({ active_workspace_id: previous }).eq("id", uid);
        }
      }
    },
    onSuccess: async () => {
      setDeletingId(null);
      setDeleteConfirm("");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["my-workspaces"] });
      await qc.invalidateQueries({ queryKey: ["active-workspace"] });
      await qc.invalidateQueries();
      toast.success("Workspace Deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete workspace."),
  });


  const list = workspaces ?? [];
  if (list.length < 2 && !active) return null;

  const canManage = (role: WsRole) => role === "owner" || role === "admin";

  return (
    <div
      className={`ws-wrap ${collapsed ? "ws-wrap-collapsed" : ""}`}
      ref={wrapRef}
    >
      <button
        type="button"
        className={`ws-btn ${collapsed ? "ws-btn-collapsed has-tip tip-right" : ""}`}
        data-tip={collapsed ? (active?.name ?? "Workspace") : undefined}
        aria-label="Switch Workspace"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="ws-dot"
          style={{ background: active?.brand_color || "#CC0000" }}
        />
        {!collapsed && (
          <>
            <span className="ws-name">{active?.name ?? "Workspace"}</span>
            <ChevronDown size={14} />
          </>
        )}
      </button>

      {open && (
        <div className={`ws-menu ${collapsed ? "ws-menu-right" : ""}`}>
          <div className="ws-menu-h">{t("Your Workspaces")}</div>
          {list.length === 0 ? (
            <div className="ws-empty">{t("No Workspaces Yet")}</div>
          ) : (
            list.map((w) => {
              const isActive = w.id === active?.id;
              const isEditing = editingId === w.id;
              const isDeleting = deletingId === w.id;

              if (isDeleting) {
                return (
                  <div key={w.id} className="ws-danger">
                    <div className="ws-danger-h">
                      <Trash2 size={13} /> Delete "{w.name}"?
                    </div>
                    <input
                      className="ws-input"
                      placeholder={`Type "${w.name}" to confirm`}
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      autoFocus
                    />
                    <div className="ws-danger-actions">
                      <button
                        type="button"
                        className="ws-danger-cancel"
                        onClick={() => {
                          setDeletingId(null);
                          setDeleteConfirm("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="ws-danger-confirm"
                        disabled={
                          deleteConfirm.trim() !== w.name || remove.isPending
                        }
                        onClick={() =>
                          remove.mutate({ id: w.id, name: w.name })
                        }
                      >
                        {remove.isPending ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              }

              if (isEditing) {
                return (
                  <form
                    key={w.id}
                    className="ws-edit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editName.trim().length >= 2) {
                        rename.mutate({ id: w.id, name: editName.trim() });
                      }
                    }}
                  >
                    <input
                      className="ws-input"
                      placeholder={t("Workspace Name")}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <div className="ws-edit-actions">
                      <button
                        type="button"
                        className="ws-edit-cancel"
                        onClick={() => {
                          setEditingId(null);
                          setEditName("");
                        }}
                      >
                        <X size={13} />
                      </button>
                      <button
                        type="submit"
                        className="ws-edit-save"
                        disabled={
                          editName.trim().length < 2 || rename.isPending
                        }
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={w.id}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? "true" : undefined}
                  className={"ws-item " + (isActive ? "ws-item-active" : "")}
                  onClick={() => {
                    if (switchTo.isPending) return;
                    if (isActive) setOpen(false); else switchTo.mutate(w.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    if (switchTo.isPending) return;
                    if (isActive) setOpen(false); else switchTo.mutate(w.id);
                  }}
                >

                  <span
                    className="ws-dot"
                    style={{ background: w.brand_color || "#CC0000" }}
                  />
                  <span className="ws-item-t">
                    <span className="ws-item-name">{w.name}</span>
                  </span>
                  <span className="ws-item-actions">
                    {canManage(w.role) && (
                      <>
                        <button
                          type="button"
                          className="ws-action edit"
                          aria-label={`Rename ${w.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(w.id);
                            setEditName(w.name);
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        {w.role === "owner" && (
                          <button
                            type="button"
                            className="ws-action delete"
                            aria-label={`Delete ${w.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(w.id);
                              setDeleteConfirm("");
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    )}
                    {isActive ? (
                      <Check size={14} className="text-[#CC0000]" />
                    ) : (
                      <Building2 size={14} className="opacity-40" />
                    )}
                  </span>
                </div>

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
                placeholder={t("Workspace Name")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="ws-create-btn"
                disabled={create.isPending}
              >
                {create.isPending ? "Creating…" : "Create"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="ws-item"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} className="text-[#CC0000]" />
              <span className="ws-item-name">{t("New Workspace")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
