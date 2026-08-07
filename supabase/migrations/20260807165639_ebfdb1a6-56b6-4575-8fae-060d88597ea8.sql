-- Agreement templates
CREATE TABLE public.agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL DEFAULT '',
  file_path text,
  file_name text,
  file_mime text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreement_templates TO authenticated;
GRANT ALL ON public.agreement_templates TO service_role;
ALTER TABLE public.agreement_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage templates" ON public.agreement_templates
  FOR ALL TO authenticated USING (org_id = public.auth_org_id()) WITH CHECK (org_id = public.auth_org_id());
CREATE TRIGGER update_agreement_templates_updated_at BEFORE UPDATE ON public.agreement_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agreements
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.agreement_templates(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  file_path text,
  file_name text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  signer_name text,
  signer_email text,
  signer_phone text,
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  signature_type text,
  signature_data text,
  signer_ip text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreements_status_check CHECK (status IN ('draft','sent','viewed','signed','declined','void')),
  CONSTRAINT agreements_token_unique UNIQUE (token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreements TO authenticated;
GRANT ALL ON public.agreements TO service_role;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage agreements" ON public.agreements
  FOR ALL TO authenticated USING (org_id = public.auth_org_id()) WITH CHECK (org_id = public.auth_org_id());
CREATE TRIGGER update_agreements_updated_at BEFORE UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX agreements_org_created_idx ON public.agreements (org_id, created_at DESC);

-- Audit trail
CREATE TABLE public.agreement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.agreement_events TO authenticated;
GRANT ALL ON public.agreement_events TO service_role;
ALTER TABLE public.agreement_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read agreement events" ON public.agreement_events
  FOR SELECT TO authenticated USING (org_id = public.auth_org_id());
CREATE POLICY "org members write agreement events" ON public.agreement_events
  FOR INSERT TO authenticated WITH CHECK (org_id = public.auth_org_id());
CREATE INDEX agreement_events_agreement_idx ON public.agreement_events (agreement_id, created_at DESC);