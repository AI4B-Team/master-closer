ALTER TABLE public.worklist_feedback
  DROP CONSTRAINT worklist_feedback_nomination_id_fkey,
  ADD CONSTRAINT worklist_feedback_nomination_id_fkey
    FOREIGN KEY (nomination_id) REFERENCES public.worklist_nominations(id) ON DELETE SET NULL;