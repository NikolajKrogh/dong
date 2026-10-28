-- League metadata ships in the versioned application catalog; no startup read is needed.
-- Preserve the seeded identities, names and policy used by saved match relationships.
drop function public.list_leagues();
drop function private.list_leagues();
