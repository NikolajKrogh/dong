-- 007_create_assignments.sql
-- Create assignments with composite PK and composite FKs enforcing same-session integrity

CREATE TABLE IF NOT EXISTS public.assignments (
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  match_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, participant_id, match_id)
);

ALTER TABLE public.assignments
  ADD CONSTRAINT fk_assignments_participant FOREIGN KEY (session_id, participant_id) REFERENCES public.participants(session_id, id),
  ADD CONSTRAINT fk_assignments_match FOREIGN KEY (session_id, match_id) REFERENCES public.matches(session_id, id);

CREATE INDEX IF NOT EXISTS idx_assignments_session_id ON public.assignments (session_id);
CREATE INDEX IF NOT EXISTS idx_assignments_participant_id ON public.assignments (participant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_match_id ON public.assignments (match_id);
