CREATE TABLE public.notification_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notification reads"
ON public.notification_reads FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id))
WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id));

CREATE INDEX notification_reads_user_ws_idx ON public.notification_reads (user_id, workspace_id);