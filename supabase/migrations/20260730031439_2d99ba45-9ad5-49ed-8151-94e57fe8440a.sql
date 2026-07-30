CREATE TABLE public.disclosure_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE,
  script text NOT NULL DEFAULT 'Quick heads up, this call may be recorded and monitored for quality and training.',
  spoken_at_call_open boolean NOT NULL DEFAULT true,
  booking_confirmation boolean NOT NULL DEFAULT true,
  outbound_pre_connect_audio boolean NOT NULL DEFAULT true,
  default_jurisdiction text NOT NULL DEFAULT 'FL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disclosure_settings TO authenticated;
GRANT ALL ON public.disclosure_settings TO service_role;

ALTER TABLE public.disclosure_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org disclosure settings all" ON public.disclosure_settings
  FOR ALL TO authenticated
  USING (org_id = public.auth_org_id())
  WITH CHECK (org_id = public.auth_org_id());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_disclosure_settings_updated_at
BEFORE UPDATE ON public.disclosure_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();