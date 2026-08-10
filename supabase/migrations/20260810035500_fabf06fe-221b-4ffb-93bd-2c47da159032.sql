ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
UPDATE public.workspaces SET onboarded_at = created_at WHERE onboarded_at IS NULL;