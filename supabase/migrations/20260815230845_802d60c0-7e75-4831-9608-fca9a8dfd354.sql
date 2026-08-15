CREATE OR REPLACE FUNCTION public.increment_contact_attempt(_contact_id uuid, _outcome text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.list_contacts
     SET attempts = COALESCE(attempts, 0) + 1,
         last_outcome = NULLIF(_outcome, '')::dial_outcome
   WHERE id = _contact_id;
$$;

REVOKE ALL ON FUNCTION public.increment_contact_attempt(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_contact_attempt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_contact_attempt(uuid, text) TO service_role;