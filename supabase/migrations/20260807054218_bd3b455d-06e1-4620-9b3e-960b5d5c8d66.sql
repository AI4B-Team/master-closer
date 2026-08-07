ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.call_lists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS daily_cap integer NOT NULL DEFAULT 100;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_integrations_updated_at ON public.integrations;
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();