# Production hosting

Use Cloudflare Pages for the Expo SPA, Cloud Run for `command-api`, and the
existing Supabase project. Guests continue to join with a room code from Home.
`/lobby/<sessionId>` resumes the signed-in account's existing membership;
participant IDs in query parameters are not used to select a role.

## Java API on Cloud Run

Deploy the `command-api` directory with source buildpacks and the build
environment variable `GOOGLE_RUNTIME_VERSION=17`. Its `.gcloudignore` excludes
local environment files and build artifacts. See Google's
[Java buildpack configuration](https://docs.cloud.google.com/docs/buildpacks/java).
Set these runtime variables:

```text
SPRING_PROFILES_ACTIVE=prod
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_JWKS_URL=https://YOUR_PROJECT.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
COMMAND_API_CORS_ALLOWED_ORIGINS=https://YOUR_APP.pages.dev
```

The service reads Cloud Run's `PORT`. Allow public invocation: match discovery
is public, while protected Java endpoints still validate Supabase JWTs. Use
minimum instances 0, maximum instances 1, request-based billing, and an initial
512 MiB memory limit. Increase memory if startup measurements require it.
Use exact web origins without trailing slashes; comma-separate the Pages and
custom-domain origins if both are used. Never activate the `dev` profile here.

## Expo web on Cloudflare Pages

Use Node 22.13 or newer, build `npm ci && npx expo export --clear --platform web`, and
publish `dist`. Set the three public build variables from the root `.env.example`
in Pages. They are embedded at build time: rebuild after changing them.

Expo uses `web.output: "single"`. Pages serves `index.html` for unknown paths
when there is no top-level `404.html`; keep that SPA fallback enabled. Dynamic
lobby paths and Auth return links therefore load the same application on direct
open and refresh. No Expo server is needed. See Cloudflare's
[SPA serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).

## Supabase and native builds

Configure the production Site URL and allowed Auth redirect URLs for the Pages
and custom-domain `/auth` routes, including onboarding and password recovery
routes used by the app. Keep native `myapp://` redirects allowed. Configure
custom SMTP before inviting real users. Deploy any pending database migrations
and guest-access Edge Functions through the existing Supabase workflow.

Put the same public variables in the EAS `production` environment (and in
`preview` for preview APKs); build profiles now select those environments.
Do not include a Supabase secret/service-role key in a client build.

## Release check

On the actual Pages URL, sign in as a host, create a room, copy the canonical
`/lobby/<sessionId>` URL, then open it directly and refresh it. Confirm the join
code and host controls return. Repeat as a registered member and confirm host
controls stay hidden. Open the URL signed out and with an unrelated account:
the app should offer sign-in or explain that there is no active membership.
From another browser/device, join as a guest using the room code and confirm
the existing guest flow still works. Check cold-start match discovery and game
start against Cloud Run. These are hosted release checks, not proof provided
by a local export.

Supabase Free can pause; an internal Cron job is not a guaranteed availability
contract. Use Pro if users must always be able to join.

## Feature 030 Match Catalog release

The [cutover/rollback ledger](../specs/030-reduce-espn-requests/validation/rollout.md) lists the exact five migrations, restricted Edge functions, DSN/key provisioning, source fence, 30/5000 budgets and operator activation/pause transactions. These commands are prepared for a later authorized release; no feature030 production deployment is implied. Schema starts with acquisition disabled and the owned Cron job inactive.

The repository currently defines client, database and Java CI, with no publication job or `workflow_dispatch`. These jobs validate source; green CI is not a Cloudflare, Cloud Run or Supabase deployment. Use the reviewed commit SHA when inspecting runs:

```powershell
$reviewedSha = '<REVIEWED_COMMIT_SHA>'
gh run list --repo NikolajKrogh/dong --commit $reviewedSha --workflow client-ci.yml --json databaseId,headSha,status,conclusion,url
gh run list --repo NikolajKrogh/dong --commit $reviewedSha --workflow db-ci.yml --json databaseId,headSha,status,conclusion,url
gh run list --repo NikolajKrogh/dong --commit $reviewedSha --workflow java-ci.yml --json databaseId,headSha,status,conclusion,url
```

Paths ignored by each workflow can mean no run exists; absence is not a passed check. The current jobs run lint/type/unused/unit, pgTAP/generated contracts and Maven respectively. No E2E or Android test is added to this release procedure.

For web, keep the existing Pages project and repository integration. The verified repository build remains:

```powershell
npm ci
npx expo export --clear --platform web
```

Publish `dist` through that existing project's reviewed production deployment. The Pages account/project/production branch are external configuration and were not recovered from this repository. Do not invent a new Pages project or claim a GitHub deploy workflow exists. If the existing project intentionally uses approved direct upload, Cloudflare documents `npx wrangler pages deploy dist --project-name <EXISTING_PROJECT_NAME>`; its account credentials and production-branch mapping must first be verified. [Direct-upload reference](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

Java retains the existing Cloud Run service and its public runtime variables above. A later operator must resolve its actual Google project, region and service before this source-build command; these targets and the `gcloud` CLI were unavailable in the current workspace:

```powershell
$googleProject = '<EXISTING_GOOGLE_PROJECT>'
$cloudRegion = '<EXISTING_REGION>'
$cloudService = '<EXISTING_CLOUD_RUN_SERVICE>'
gcloud run deploy $cloudService --project $googleProject --region $cloudRegion --source .\command-api --set-build-env-vars GOOGLE_RUNTIME_VERSION=17 --update-env-vars SPRING_PROFILES_ACTIVE=prod --allow-unauthenticated --min-instances 0 --max-instances 1 --memory 512Mi
```

This is a parameterized manual publication command, not an executed/verified target deployment. Preserve the existing Supabase URL/JWKS/public app key and exact production CORS variables; never add the catalog DSN or monitor secret to Java or the client. Inspect actual revision traffic/tags and retire every routable Java revision that still fetches ESPN before source ownership activation. [Current command flags](https://cloud.google.com/sdk/gcloud/reference/run/deploy).

Android build delivery and device testing are **skipped for feature030 at the user's request**. Existing EAS profiles remain unchanged. Refresh maintained web tabs after publication and record supported bundle/revision adoption: old solo bundles can still call ESPN directly, so their traffic cannot be included in an all-client consolidation claim. Hosted release checks remain separate from local unit/database/controlled-transport evidence.
