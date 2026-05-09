# Legacy History Import Contract

## Purpose

This contract defines the public boundary for the one-time local-to-cloud import. The client does not write directly to the gameplay tables. It sends a normalized legacy-session payload to a Supabase RPC, and the RPC creates or skips the canonical cloud rows while recording import state in a private ledger.

## Public Entry Point

### `import_legacy_history`

The feature exposes a single RPC-style write path.

**Caller**: authenticated registered user
**Schema boundary**: public wrapper function that delegates to private import helpers
**Trust boundary**: the server validates the account, claimant, fingerprints, and session writes

## Request Shape

```json
{
  "claimedLocalParticipantId": "local-player-123",
  "sessions": [
    {
      "sourceLocalSessionId": "1694529378123",
      "savedAt": "2026-05-01T18:25:43.511Z",
      "claimedLocalParticipantId": "local-player-123",
      "commonMatchId": "match-1",
      "matchesPerPlayer": 3,
      "players": [
        { "id": "local-player-123", "name": "Sam", "drinksTaken": 4 },
        { "id": "local-player-456", "name": "Jordan", "drinksTaken": 2 }
      ],
      "guestParticipants": [
        { "id": "local-player-456", "name": "Jordan", "drinksTaken": 2 }
      ],
      "matches": [
        {
          "id": "match-1",
          "homeTeam": "Team A",
          "awayTeam": "Team B",
          "homeGoals": 2,
          "awayGoals": 1,
          "startTime": "2026-05-01T18:30:00.000Z"
        }
      ],
      "playerAssignments": {
        "local-player-123": ["match-1"],
        "local-player-456": ["match-1"]
      }
    }
  ]
}
```

## Response Shape

```json
{
  "accountId": "uuid",
  "importState": "in_progress",
  "claimedLocalParticipantId": "local-player-123",
  "summary": {
    "importedCount": 1,
    "skippedCount": 0,
    "failedCount": 0
  },
  "sessions": [
    {
      "sourceLocalSessionId": "1694529378123",
      "sourceFingerprint": "sha256:...",
      "state": "imported",
      "cloudSessionId": "uuid"
    }
  ]
}
```

## Behavioral Rules

- The caller must be authenticated.
- The claimant must be one participant from the submitted payload.
- The RPC must compute a deterministic source fingerprint server-side from the normalized session payload.
- A matching `(account_id, source_fingerprint)` row must be treated as already imported.
- A completed account import must no-op or return already-imported status on later runs.
- Partial failures must not roll back successful sessions in the same batch.
- Guest participants should be carried in the request as session-scoped snapshots and remain non-claimable.
- Guest participants must remain session-scoped and must not be promoted into durable account records.

## Error / Status Semantics

| State         | Meaning                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `in_progress` | Import has begun and at least one session is still eligible to process |
| `imported`    | A source session was written into the canonical cloud tables           |
| `skipped`     | The same source fingerprint was already recorded for this account      |
| `failed`      | The session could not be normalized or written                         |
| `conflict`    | The payload conflicts with existing claimant or fingerprint state      |

## Notes for Client Integration

- The Settings screen should show claimant selection before the RPC call starts.
- The client should persist no secret import marker of its own; the server ledger is authoritative.
- The response should be used to show per-session status and whether the account import is already complete.
