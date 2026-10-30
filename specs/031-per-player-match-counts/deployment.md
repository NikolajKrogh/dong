# Current rollout status

All three feature migrations and the authenticated preview Edge function are deployed. Capabilities are active;39 pre-existing games remain v1 with zero overrides. See [implementation.md](implementation.md) for immutable hashes, security checks and validation limits. The historical foundation-only record below is superseded by this completed rollout.

# Hosted foundation deployment — 2026-10-30

The user authorized applying the required Supabase migrations. Deployed to DONG (`qccvlhblytuedgmlqfef`) using the CLI to preserve the repository migration version.

Applied `20261030144426_per_player_match_counts.sql`, SHA256 `0295A711DBC33DCE8A04FE3F756EBB600473B6C1B888676B2C4F583E86451B94`. This file is now immutable. Remaining SQL work requires a new CLI-generated follow-up migration; do not append to or replay this deployed file.

Before deployment, hosted migration history matched all earlier local versions. Hosted legacy function bodies matched the tested local definitions after whitespace normalization. Dry-run listed exactly this migration. An isolated fresh reset with standard synthetic seed and all database units passed:72files/1190assertions. The command was `supabase db push --project-ref qccvlhblytuedgmlqfef --skip-vault --yes`; no seed, role, Vault or Edge Function deployment was included.

## Staged behavior

The schema and inactive command foundation are deployed. Both snapshot capabilities (`perPlayerMatchCounts`, `assignmentPreview`) remain false. Anon and authenticated execution of the new v2 adoption RPC is revoked until v2 start/save support is complete. Its unit suite explicitly checks those grants, then grants access inside its rolled-back test transaction to exercise the future host/replay contract.

Existing clients continue on v1. No game was adopted and no assignments, scores, drinks or history records were rewritten. The unfinished preview Edge function was not deployed.

## Hosted verification

- Migration history contains version20261030144426/nameper_player_match_counts.
- Post-deploy dry-run returns `upToDate:true` and an empty pending migration list.
- All38 existing sessions retain assignment policy1; zero participant overrides were introduced.
- All hosted room snapshots still build and report both capabilities false and policy1.
- Anon/authenticated cannot execute the new adoption RPC.
- Preserved legacy plan/settings/start function bodies retain their pre-deployment normalized hashes.

Security advisors reported no finding for the new objects. Existing-object observations include [mutable search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonymous SECURITY DEFINER access](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated RPC access](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), and [MFA options](https://supabase.com/docs/guides/auth/auth-mfa). Those unrelated objects/settings were not changed.

Full feature activation remains unfinished. E2E and Android-device testing remain deferred by user request. No commit was created.
