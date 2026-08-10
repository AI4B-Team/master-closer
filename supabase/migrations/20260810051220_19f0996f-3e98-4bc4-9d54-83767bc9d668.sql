CREATE TABLE public.calling_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  start_minute integer NOT NULL DEFAULT 480,
  end_minute integer NOT NULL DEFAULT 1260,
  days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  default_timezone text NOT NULL DEFAULT 'America/New_York',
  enforce boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calling_windows_span CHECK (start_minute >= 0 AND end_minute > start_minute AND end_minute <= 1440)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calling_windows TO authenticated;
GRANT ALL ON public.calling_windows TO service_role;

ALTER TABLE public.calling_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members manage calling window" ON public.calling_windows
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE TRIGGER update_calling_windows_updated_at
BEFORE UPDATE ON public.calling_windows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.calling_window_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone text,
  lead_timezone text NOT NULL,
  timezone_source text NOT NULL,
  local_time text NOT NULL,
  reason text NOT NULL,
  attempted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.calling_window_blocks TO authenticated;
GRANT ALL ON public.calling_window_blocks TO service_role;

ALTER TABLE public.calling_window_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view calling blocks" ON public.calling_window_blocks
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "workspace members log calling blocks" ON public.calling_window_blocks
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE INDEX calling_window_blocks_ws_idx ON public.calling_window_blocks (workspace_id, created_at DESC);