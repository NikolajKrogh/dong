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
