# Release review

Implementation/test results remain recorded in the individual validation documents; this file does not authorize deployment or claim hosted activation.

Before activation, audit every custom database LOGIN and trust the designated worker login with queued monitor headers. Keep `net` outside the Data API schemas and client roles NOLOGIN. Managed pg_net ACLs cannot provide per-project queue isolation; ordinary SQL revocations must not be presented as successful protection. Verify API schema denial and the named-secret/dispatch checks. Evidence: [pg-net-security.md](pg-net-security.md).

The feature's relations use private schemas, explicit RLS and narrow function grants. Public saved reads use an invoker wrapper around a fixed-search-path private projection. The worker role has no application table/operator permissions; typed accepted-observation references and provider actor constraints guard room events, while participant command actors remain required. Goals keep unknown roles and meaningful revisions; no participant impersonation or raw source archive was introduced. Query plans and real allocation measurements are recorded separately.

The exact five-file hosted migration dry run succeeded. Hosted advisors are a pre-feature baseline, not a verdict about undeployed objects: 38 security information/warnings and 10 performance informational findings were recorded without unrelated remediation. Repeat target security/performance checks after the approved migration. Local schema/access tests pass, including named-secret denial, issuance lifecycle, NOLOGIN API roles and actual REST denial for `Accept-Profile: net`.

Post-implementation constitution review: the shared authoritative state remains Postgres; meaningful provider facts and room effects have durable evidence; registered/guest authorization is preserved; one deep module exposes three consumer operations; client data still belongs to the existing local store. Unit, database, actual-adapter concurrency and Java checks passed. The user's E2E waiver and Android deferral are explicit, so neither platform journey is reported as accepted. No new scheduler platform, paid service, storage archive or speculative notification delivery was added.

Activation still requires the trusted custom LOGIN/queue audit, real Supavisor/TLS/timeout smoke, hosting targets and supported revision adoption, signing/monitor key provisioning, post-deploy advisors and the bounded live request cap in the rollout document. Local results do not authorize those writes or establish sustained hosted capacity.
