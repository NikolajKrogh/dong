# Research: Host Profile and Synced Settings

## Decision 1: Keep profile data on the account row

Decision: Store the editable profile state on `public.accounts`, extending the existing account identity row rather than moving the feature to `public.profiles`.

Rationale: The current auth flow already boots and updates account state through `hooks/useAccountAuth.ts`, and the delete-account function already treats `public.accounts` as the durable identity record that cascades to related data. Keeping the profile on the same row avoids a second authority for identity data.

Alternatives considered: Move the editable profile to `public.profiles`; rejected because it splits the identity source of truth away from the row already used by authentication and host state. Mirror data into both account and profile rows; rejected because it adds sync risk without a clear benefit.

## Decision 2: Sync supported preferences through `public.settings`

Decision: Use the existing `public.settings.settings_data` JSONB column for the cloud-backed preference set and map the supported settings there.

Rationale: The table already exists, already has RLS/grants coverage, and already models a 1:1 account-scoped preference surface. Storing the supported preference keys as a single JSON payload keeps the cloud model aligned with the current local Zustand store shape and avoids introducing another table or duplicate CRUD layer.

Alternatives considered: Add separate columns for each preference; rejected because the feature needs to sync a small group of app settings and JSONB keeps the payload flexible. Create a new settings table; rejected because the current table already matches the required ownership and security model.

## Decision 3: Hydrate cloud state into the local store on auth restore

Decision: Keep the local AsyncStorage store as the device fallback, but overlay account-backed profile and settings values onto the app state when a session is restored or refreshed.

Rationale: The app already persists a broad device-local state slice in Zustand/AsyncStorage. Cross-device sync should update the supported settings only after Supabase confirms the active session, while sign-out or session expiration should return the UI to a safe signed-out state without erasing device-local preferences.

Alternatives considered: Make Supabase the only source of truth for every preference; rejected because it would change the existing offline/device-local behavior. Keep everything local-only; rejected because the feature explicitly requires cloud-backed profile and settings restoration.

## Decision 4: Keep validation non-unique and trim-only for profile text

Decision: Enforce trimmed, non-empty validation on the display name and do not add uniqueness rules for the clarified profile identifier.

Rationale: The clarified spec allows duplicate values and punctuation, so the implementation only needs to reject blank or whitespace-only submissions and keep the previous saved profile intact on validation failure.

Alternatives considered: Unique display-name enforcement; rejected because duplicates are allowed. Regex-heavy display-name rules; rejected because the clarified requirement intentionally keeps the rule set simple.

## Decision 5: Supabase posture and breaking-change review

Decision: Reuse existing public tables and keep the current RLS/grant posture instead of introducing a new exposed table.

Rationale: The Supabase changelog includes a breaking change where new public tables are no longer exposed to the Data API automatically. This feature avoids that risk by reusing the existing `public.accounts` and `public.settings` tables and keeping their access rules aligned with the current repo patterns.

Alternatives considered: Introduce a new public profile/settings table; rejected because it would add exposure and migration overhead without improving the feature shape.

## Supporting Repo Context

- `hooks/useAccountAuth.ts` already owns auth/session bootstrap and account bootstrap.
- `app/userPreferences.tsx` already renders the preferences screen and account section.
- `store/store.ts` already contains the device-local preference slice that will be synced.
- `supabase/tests/database/030_profiles_settings_rls.test.sql` already shows the existing account/profile/settings RLS test style.
