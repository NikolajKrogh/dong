# Data Model: Host Profile and Synced Settings

## Account

Represents the signed-in host identity that owns the profile data.

### Fields

- `id`: UUID, primary key and auth user id.
- `preferred_display_name`: text, the visible display name shown in the app.
- `created_at`: timestamp with time zone.
- `updated_at`: timestamp with time zone.

### Rules

- `preferred_display_name` is trimmed before save.
- Blank or whitespace-only values are rejected.
- Duplicate values are allowed.
- Punctuation is allowed.
- The account row remains the source of truth for profile edits.

### Relationships

- One account maps to one authenticated host identity.
- One account may own one synced settings row.

## Synced Settings

Represents the cloud-backed preference set that must follow the host across devices.

### Fields

- `account_id`: UUID, primary key and foreign key to `public.accounts.id`.
- `settings_data`: JSONB, the serialized preference payload.
- `created_at`: timestamp with time zone.
- `updated_at`: timestamp with time zone.

### Supported Keys

- `theme`
- `soundEnabled`
- `commonMatchNotificationsEnabled`
- `configuredLeagues`
- `defaultSelectedLeagues`

### Rules

- Only the supported keys are synced to the cloud.
- The JSON payload must round-trip the same shape the app uses for the persisted preference subset.
- Device-local gameplay state does not belong in this payload.

### Relationships

- One account row maps to zero or one settings row.
- Settings are read after auth restore and written when the host changes supported preferences.

## Local Preference State

Represents the device-scoped state that remains in AsyncStorage.

### Fields

- `theme`
- `soundEnabled`
- `commonMatchNotificationsEnabled`
- `configuredLeagues`
- `defaultSelectedLeagues`
- other existing gameplay state that is not part of this feature

### Rules

- Local state remains available even when the host is signed out.
- Cloud-backed settings should hydrate this state when a valid session is restored.
- Sign-out and session expiration must not erase the device-local store.

## State Transitions

1. Signed out: local state remains, cloud profile/settings are unavailable.
2. Signed in and restored: account row and settings row hydrate the authenticated host state.
3. Profile/settings updated: app saves the account row and settings row, then refreshes local state.
4. Signed out or expired session: account-bound UI clears, local device state remains.

## Migration Notes

- Keep the existing account row focused on `preferred_display_name`; no additional profile column is required.
- Keep the existing settings row and JSONB payload shape.
- No game-history migration or event backfill is required.
