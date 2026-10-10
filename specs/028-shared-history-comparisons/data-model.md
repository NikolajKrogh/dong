# Data Model

Reuse accounts, friendships, blocks, completed sessions/participants, recorded snapshots and participation authorization. No new canonical tables.

Eligible contribution: distinct registered (account_id, session_id) with completed state, non-null started_at/completed_at, valid recorded participation and a six-digit join_code. Exclude any session with legacy-import: event keys, imported=true event payload, or legacy_import match provenance. The exact predicate and inspected creation paths are in research.md; preflight stops on unknown/conflicting origins instead of silently dropping genuine games. Exclude pre-start departures, local and ongoing games. Drinks use canonical numeric current_drink_total (preserved for leavers). Never union departure snapshots or sum joined duplicate events. Conflicting canonical identity/provenance fails preflight rather than guessing.

AccountStats: account_id, current username, games_participated integer, total_drinks numeric, average_drinks numeric|null. Average=total/count; zero games yields null average, zero count/total. Zero-drink games count. Compute before rounding; display one decimal, never classify ties on rounded values.

SharedStats: shared_games; viewer/target total and average; viewer_higher_count, target_higher_count, tied_count. Dataset is eligible-session intersection, including departures. Three outcome counts sum to shared_games.

SharedGame: session_id, completed_at, existing summary fields, recorded participants and left_at markers. TimelinePoint: shared session/time, both drinks and departure markers. No separate-game fields in overall output.

CoPlayerContext: evidenced registered account identity, permitted current label, relationship and existing actionable Person fields. Blocked/unavailable targets expose no social action/directional block information. Guests/local players remain session-specific and do not enter account totals.

State: hidden/checking → authorized/displayed or connection/auth/unavailable error. Each mandatory lifecycle check hides old data first. Account/refresh generations fence delayed callbacks; failed pages clear social payload. Personal access remains independent. No persisted cache/polling/offline fallback.

Migration: additive private functions/public wrappers, explicit grants, reuse indexes or add measured missing ones. Test clean/upgrade paths and old policies; regenerate types from tested schema. No guessed username/account backfill or restoration of retired import functionality.
