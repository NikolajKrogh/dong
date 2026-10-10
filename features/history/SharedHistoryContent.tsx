import React, { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { ShellActionButton } from '../../components/ui';
import GameDetailsModal from '../../components/history/GameDetailsModal';
import type { useSocialHistory } from './useSocialHistory';
import type { AccountStats } from './socialHistoryRepository';

type SharedHistoryView = ReturnType<typeof useSocialHistory>;

function formatDrinks(value: number | null | undefined): string {
  return value == null ? 'Unavailable' : value.toFixed(1);
}

function StatsColumn({ stats, label }: { stats: AccountStats; label: string }): React.ReactElement {
  return (
    <YStack flex={1} minWidth={140} gap="$2">
      <Text accessibilityRole="header" fontSize={18} fontWeight="700" color="$textPrimary">
        {label}
      </Text>
      <Text color="$textPrimary">{stats.games_participated} games participated</Text>
      <Text color="$textPrimary">{formatDrinks(stats.total_drinks)} total drinks</Text>
      <Text color="$textMuted">{formatDrinks(stats.average_drinks)} drinks per game</Text>
    </YStack>
  );
}

function SharedGames({
  view,
  onSelectGame,
}: {
  view: SharedHistoryView;
  onSelectGame: (id: string) => void;
}): React.ReactElement | null {
  const data = view.data;
  if (!data) return null;

  return (
    <>
      {data.games.items.map((game) => (
        <YStack key={game.id} gap="$2" paddingVertical="$2">
          <ShellActionButton
            role="button"
            variant="surface"
            label={`View shared game · ${new Date(game.date).toLocaleDateString()}`}
            onPress={() => onSelectGame(game.id)}
          />
          {game.players.filter((player) => player.leftAt).map((player) => (
            <Text key={player.id} color="$textMuted">
              {player.name} · Left early · {formatDrinks(player.drinksTaken)} drinks
            </Text>
          ))}
        </YStack>
      ))}
      {data.games.next_cursor ? (
        <ShellActionButton
          role="button"
          variant="surface"
          label={view.paging ? 'Loading…' : 'More shared games'}
          disabled={view.paging}
          onPress={() => { void view.loadGames(); }}
        />
      ) : null}
    </>
  );
}

function SharedTimeline({ view, username }: { view: SharedHistoryView; username: string }): React.ReactElement | null {
  const timeline = view.timeline;
  if (!timeline || !view.data) return null;

  return (
    <YStack gap="$2">
      <Text accessibilityRole="header" fontWeight="700" color="$textPrimary">
        Shared drink timeline · {timeline.next_cursor ? 'Partial' : 'Complete'}
      </Text>
      <Text color="$textMuted">Oldest to newest among the loaded shared games.</Text>
      {timeline.items.map((point) => (
        <YStack key={point.session_id} paddingVertical="$2">
          <Text color="$textPrimary">{new Date(point.completed_at).toLocaleDateString()}</Text>
          <Text color="$textPrimary">
            You: {formatDrinks(point.viewer_drinks)}{point.viewer_left_at ? ' · Left early' : ''}
            {' · '}{username}: {formatDrinks(point.target_drinks)}{point.target_left_at ? ' · Left early' : ''}
          </Text>
        </YStack>
      ))}
      {timeline.next_cursor ? (
        <ShellActionButton
          role="button"
          variant="surface"
          label="More timeline games"
          disabled={view.paging}
          onPress={() => { void view.loadTimeline(); }}
        />
      ) : null}
    </YStack>
  );
}

export default function SharedHistoryContent({ view }: { view: SharedHistoryView }): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const data = view.data;
  const selected = data?.games.items.find((game) => game.id === selectedId) ?? null;

  return (
    <YStack gap="$4">
      {view.checking ? (
        <Text color="$textMuted" accessibilityLiveRegion="polite">Checking access…</Text>
      ) : null}
      {view.error ? (
        <YStack gap="$3">
          <Text color="$danger" accessibilityRole="alert">{view.error}</Text>
          <ShellActionButton role="button" label="Retry" onPress={() => { void view.refresh(); }} />
        </YStack>
      ) : null}

      {data ? (
        <YStack gap="$5">
          <Text color="$textMuted">
            Friends · {data.shared.shared_games} games together · All time
          </Text>
          <YStack gap="$3">
            <Text accessibilityRole="header" fontSize={22} fontWeight="700" color="$textPrimary">
              Overall stats
            </Text>
            <Text color="$textMuted">All completed online games, including games played separately.</Text>
            <XStack flexWrap="wrap" gap="$4">
              <StatsColumn stats={data.viewer} label="You" />
              <StatsColumn stats={data.target} label={data.target.username} />
            </XStack>
          </YStack>

          <YStack gap="$3">
            <Text accessibilityRole="header" fontSize={22} fontWeight="700" color="$textPrimary">
              Your games together
            </Text>
            <Text color="$textMuted">All time · Completed online games only</Text>
            <XStack flexWrap="wrap" gap="$4">
              <StatsColumn
                label="You"
                stats={{
                  ...data.viewer,
                  games_participated: data.shared.shared_games,
                  total_drinks: data.shared.viewer_total_drinks,
                  average_drinks: data.shared.viewer_average_drinks,
                }}
              />
              <StatsColumn
                label={data.target.username}
                stats={{
                  ...data.target,
                  games_participated: data.shared.shared_games,
                  total_drinks: data.shared.target_total_drinks,
                  average_drinks: data.shared.target_average_drinks,
                }}
              />
            </XStack>
            <Text color="$textPrimary">
              Higher drink count: You {data.shared.viewer_higher_count} · {data.target.username}{' '}
              {data.shared.target_higher_count} · Ties {data.shared.tied_count}
            </Text>
            <Text color="$textMuted">
              Counts describe recorded drinks. Players who left early participated for less time.
            </Text>
            {!data.shared.shared_games ? (
              <Text color="$textMuted">
                No completed online games together yet. Your overall stats are still available.
              </Text>
            ) : null}

            <SharedGames view={view} onSelectGame={setSelectedId} />
            {data.shared.shared_games ? (
              <ShellActionButton
                role="button"
                variant="surface"
                label={view.paging ? 'Loading…' : view.timeline ? 'Refresh shared history' : 'Show drink timeline'}
                disabled={view.paging}
                onPress={() => {
                  if (view.timeline) void view.refresh();
                  else void view.loadTimeline();
                }}
              />
            ) : null}
            <SharedTimeline view={view} username={data.target.username} />
          </YStack>
        </YStack>
      ) : null}

      {selected ? (
        <GameDetailsModal visible game={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </YStack>
  );
}
