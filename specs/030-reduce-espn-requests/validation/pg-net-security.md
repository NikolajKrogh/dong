# Managed pg_net security boundary — 2026-10-26

Supabase manages `net` and its queue as `supabase_admin`, with required PUBLIC object grants. The ordinary `postgres` migration role cannot revoke those owner-issued grants. Local ACL/role metadata confirmed this behavior; no queue rows, request headers or stored responses were inspected. [Official explanation and supported controls](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).

The ineffective M3 revocations were removed. Client API roles and the backend group are NOLOGIN; the designated worker LOGIN is trusted with provider operations. Queued monitor headers can be inspected by database LOGIN roles. **Audit every custom LOGIN before activation** and keep `net` outside exposed Data API schemas. This is a deployment precondition, not a successful SQL ACL isolation claim.

Verified local evidence:

- Repository `supabase/config.toml` exposes only `public` and `graphql_public`.
- Anonymous REST request to isolated feature030, with `Accept-Profile: net`, returned **HTTP 406**. It requested zero rows, and neither response content nor queue data was inspected.
- The local anonymous key was captured from CLI JSON in memory and never printed or written to this document.
- The SQL authority matrix still denies client/worker operator access and unrestricted private provider-table access; worker ingress additionally requires its named secret and current dispatch token/generation.

No hosted schema/role audit, hosted Data API denial, credential rotation or activation is established by this local check.
