# Research: Account Authentication

## Decision 1: Bootstrap `public.accounts` from the authenticated client, not from an auth trigger

Decision: The app will create or update the signed-in user’s own `public.accounts` row from the client after Supabase returns an authenticated session.

Rationale: The repository already treats `public.accounts` as the canonical host identity table and many database fixtures seed it manually. A trigger on `auth.users` would force broader test rewrites and would couple sign-up behavior to hidden database lifecycle logic. A client-side bootstrap keeps the flow explicit, testable, and aligned with the current Expo + Supabase architecture.

Alternatives considered:

- `auth.users` trigger in a private schema. Rejected because it would create hidden coupling and broad test churn for little benefit.
- Edge Function or custom RPC for provisioning. Rejected because the app already has direct authenticated access to its own row and does not need a second backend layer.

## Decision 2: Treat Supabase auth session state as the only persisted auth state

Decision: Use the existing AsyncStorage-backed Supabase client session rather than adding a separate Zustand or AsyncStorage auth store.

Rationale: `utils/supabaseClient.ts` already enables session persistence and token refresh. The auth UI can read `getSession()` / `getUser()` and react to auth events without introducing another source of truth.

Alternatives considered:

- Store auth state in the app store. Rejected because it would duplicate Supabase state and make restore/sign-out behavior harder to keep correct.

## Decision 3: Add a dedicated host-auth route group and a preferences entry point

Decision: Put the interactive auth flow under `app/auth/` and surface account management from the existing preferences screen.

Rationale: The existing onboarding component is a local first-launch tutorial, not an auth flow. Host auth needs separate sign-in, sign-up, onboarding, and recovery screens, and preferences is the least disruptive entry point because the clarified spec keeps local game setup, history, and preferences public.

Alternatives considered:

- Reuse `components/OnboardingScreen.tsx`. Rejected because it is already semantically bound to the local tutorial flow.
- Add a new home-screen CTA. Rejected for now because preferences already contains the right account/settings affordance.

## Decision 4: Support web and native recovery with explicit redirect handling

Decision: Web will continue to rely on Supabase’s URL detection, while native recovery will use Expo Router / Expo Linking with the app scheme defined in `app.config.ts`.

Rationale: The current client wrapper already enables `detectSessionInUrl` on web only. Password recovery needs a route that can finish the flow on both platforms, and the existing `myapp` scheme gives native a stable deep-link target.

Alternatives considered:

- Web-only recovery. Rejected because the spec requires native and web parity.
- Custom backend redirect handler. Rejected because the app can handle the route locally.

## Decision 5: Secure `public.accounts` with explicit grants, RLS, and a non-empty-name check

Decision: Add explicit `GRANT`s and owner-only RLS policies for `public.accounts`, plus a check that rejects blank display names while allowing `NULL` before onboarding completes.

Rationale: Supabase’s current platform behavior requires explicit table exposure for the Data API, and RLS must be enabled for exposed public tables. The check constraint keeps onboarding data clean without forcing duplicate display names to be unique.

Alternatives considered:

- Unique display name constraint. Rejected because the spec explicitly allows duplicates.
- Leave `accounts` unrestricted. Rejected because public tables need explicit security boundaries.

## Decision 6: Use `getUser()` / `onAuthStateChange()` for restore and sign-out, not local assumptions

Decision: The auth hook will treat Supabase events and `getUser()` as authoritative for session restore, sign-out, and post-recovery state.

Rationale: Sign-up may yield an immediate session, but app launch, page reload, and recovery flows all need a verified current user before host-only actions are allowed.

Alternatives considered:

- Trust cached state only. Rejected because stale client state would misclassify signed-out users as authenticated.
