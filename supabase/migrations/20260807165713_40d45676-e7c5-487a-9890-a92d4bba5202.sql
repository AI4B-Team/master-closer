CREATE POLICY "org members read agreement files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'agreements' AND (storage.foldername(name))[1] = public.auth_org_id()::text);
CREATE POLICY "org members upload agreement files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agreements' AND (storage.foldername(name))[1] = public.auth_org_id()::text);
CREATE POLICY "org members update agreement files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'agreements' AND (storage.foldername(name))[1] = public.auth_org_id()::text);
CREATE POLICY "org members delete agreement files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'agreements' AND (storage.foldername(name))[1] = public.auth_org_id()::text);