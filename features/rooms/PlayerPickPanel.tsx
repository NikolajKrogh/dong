import React, { useCallback, useMemo, useState } from "react";
import { Text, YStack } from "tamagui";

import { MatchSelectionCard } from "../game-setup/MatchSelectionCard";
import {
  SelectableMatchList,
  type SelectableMatch,
} from "../game-setup/SelectableMatchList";
import { ShellActionButton } from "../../components/ui";

interface PlayerPickPanelProps {
  /**
   * The room's pool, already mapped to the shared view-model and already
   * excluding the Common Match.
   *
   * Mapped by the caller rather than here, because `RoomMatchSummary` and
   * `GuestRoomMatchSummary` do not unify (`sourceProvider` is `string` vs
   * `string | null`; the score fields likewise), so there is no snapshot type
   * this component could accept for both surfaces.
   */
  matches: SelectableMatch[];
  /** This participant's picks as the last polled snapshot reported them. */
  myPicks: string[];
  /** The room's per-player count — the pick cap (FR-040). */
  cap: number;
  /** Submits the complete next set: picks are replace-all, matching the RPC. */
  onSetPicks: (matchIds: string[]) => void | Promise<void>;
  /** True while a submission and its follow-up refresh are in flight. */
  isBusy?: boolean;
  testID?: string;
  title?: string;
  compact?: boolean;
  flat?: boolean;
}

function getPickInstruction(cap: number, pickedCount: number): string {
  if (!(cap > 0)) return "You get the common match only. No picks needed.";
  if (pickedCount >= cap) return "All matches chosen. Tap one to change your selection.";

  const remaining = cap - pickedCount;
  const matchLabel = remaining === 1 ? "match" : "matches";
  if (pickedCount === 0) return `Choose ${remaining} ${matchLabel}.`;
  return `Choose ${remaining} more ${matchLabel}.`;
}

/**
 * Lets one participant pick their own matches from the host's pool in
 * player-picked mode (FR-038, FR-040).
 *
 * Used by three call sites — the lobby's host branch, the lobby's member branch
 * (the host is an ordinary participant who picks too), and the guest surface.
 *
 * ## Why it holds local state
 *
 * Picks are submitted **replace-all**, and `myPicks` arrives from a poll that
 * lags by up to ~4s (~1s for guests). Deriving each submission from `myPicks`
 * alone would lose writes:
 *
 *     tap A → submit [A]                    (server: [A])
 *     tap B → myPicks still [] → submit [B] (server: [B], A silently gone)
 *
 * So the selection is held locally, seeded from `myPicks` and re-seeded whenever
 * the server's own view of it changes. `isBusy` still gates the controls, but the
 * local state is what makes a second tap additive rather than destructive.
 */
export function PlayerPickPanel({
  matches,
  myPicks,
  cap,
  onSetPicks,
  isBusy = false,
  testID = "lobby-player-pick-panel",
  title = "Your matches",
  compact = false,
  flat = false,
}: PlayerPickPanelProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [localPicks, setLocalPicks] = useState<string[]>(myPicks);

  // Re-seed when the server's view actually changes — including a reconciliation
  // that drops a pick the server refused, or one cascaded away by a removed
  // match. Compared by value, so a fresh array with identical contents (every
  // poll produces one) does not clobber an in-flight local selection.
  const myPicksKey = useMemo(() => [...myPicks].sort().join("|"), [myPicks]);
  const [seededFrom, setSeededFrom] = useState(myPicksKey);
  const [wasBusy, setWasBusy] = useState(isBusy);
  if (wasBusy !== isBusy) setWasBusy(isBusy);
  if (seededFrom !== myPicksKey || (wasBusy && !isBusy)) {
    // Adjusting state during render rather than in an effect: React discards this
    // render and immediately re-renders with the new state, so there is no commit
    // showing stale picks — and no cascading-render lint warning.
    setSeededFrom(myPicksKey);
    setLocalPicks(myPicks);
  }

  const atCap = localPicks.length >= cap;

  const disabledMatchIds = useMemo(
    () => {
      if (isBusy) return matches.map((match) => match.id);
      if (!atCap) return [];
      const pickedIds = new Set(localPicks);
      return matches
        .filter((match) => !pickedIds.has(match.id))
        .map((match) => match.id);
    },
    [atCap, isBusy, matches, localPicks],
  );

  const handleToggle = useCallback(
    (matchId: string) => {
      const next = localPicks.includes(matchId)
        ? localPicks.filter((id) => id !== matchId)
        : [...localPicks, matchId];

      if (next.length > cap) {
        return;
      }

      setLocalPicks(next);
      void onSetPicks(next);
    },
    [cap, localPicks, onSetPicks],
  );

  const handleClearPicks = useCallback(() => {
    setLocalPicks([]);
    void onSetPicks([]);
  }, [onSetPicks]);

  return (
    <YStack testID={testID} gap="$2">
      <MatchSelectionCard
        compact={compact}
        flat={flat}
        title={title}
        selectedCount={localPicks.length}
        totalCount={cap}
        collapsed={collapsed}
        onToggleCollapsed={flat ? undefined : () => setCollapsed((value) => !value)}
        testID={`${testID}-card`}
        badgeTestID={`${testID}-count`}
        headerAction={localPicks.length > 0 ? (
          <ShellActionButton
            variant="text"
            widthMode="fit"
            label="Clear picks"
            testID={`${testID}-release-all`}
            disabled={isBusy}
            onPress={handleClearPicks}
          />
        ) : null}
      >
        <YStack gap="$2">
          <Text color="$colorMuted" fontSize={13}>
            {getPickInstruction(cap, localPicks.length)}
          </Text>

          <SelectableMatchList
            matches={matches}
            selectedMatchIds={localPicks}
            onToggleMatch={handleToggle}
            testIDPrefix={`${testID}-option`}
            disabledMatchIds={disabledMatchIds}
          />
        </YStack>
      </MatchSelectionCard>
    </YStack>
  );
}
