import React from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import type { GameSession } from '../../components/history/historyTypes';
import { ShellActionButton } from '../../components/ui';
import type { Person, useFriends } from '../friends';
import type { AccountStats } from './socialHistoryRepository';
import { getHistoryTimestamp } from './historyDate';
import { invalidateSocialHistory, usePersonalHistoryStats, useSocialHistory } from './useSocialHistory';

type Totals = Pick<AccountStats, 'games_participated' | 'total_drinks' | 'average_drinks'>;

function formatDrinks(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(1);
}

function ComparisonTable({
  viewer,
  target,
  username,
}: {
  viewer: Totals;
  target: Totals;
  username: string;
}): React.ReactElement {
  const rows: [string, string, string][] = [
    ['Games played', String(viewer.games_participated), String(target.games_participated)],
    ['Recorded drinks', formatDrinks(viewer.total_drinks), formatDrinks(target.total_drinks)],
    ['Per game', formatDrinks(viewer.average_drinks), formatDrinks(target.average_drinks)],
  ];

  return (
    <YStack gap="$2">
      <XStack gap="$2">
        <Text flex={2} />
        <Text flex={1} textAlign="right" color="$textPrimary" fontWeight="700" accessibilityRole="header">
          You
        </Text>
        <Text flex={1} textAlign="right" color="$textPrimary" fontWeight="700" accessibilityRole="header">
          {username}
        </Text>
      </XStack>
      {rows.map(([label, you, friend]) => (
        <XStack key={label} gap="$2" borderTopWidth={1} borderColor="$borderColor" paddingTop="$2">
          <Text flex={2} color="$textMuted">{label}</Text>
          <Text flex={1} textAlign="right" color="$textPrimary">{you}</Text>
          <Text flex={1} textAlign="right" color="$textPrimary">{friend}</Text>
        </XStack>
      ))}
    </YStack>
  );
}

interface FriendStatisticsProps {
  person: Person;
  expanded: boolean;
  onToggle: () => void;
  personalAvailable: boolean;
}

function FriendStatistics({ person, expanded, onToggle, personalAvailable }: FriendStatisticsProps): React.ReactElement {
  const view = useSocialHistory(person.account_id);
  const data = view.data;

  return (
    <YStack
      backgroundColor={expanded ? '$primaryLighter' : '$surface'}
      borderRadius="$3"
      borderWidth={1}
      borderColor={expanded ? '$primary' : '$borderColor'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Compare with ${person.username}`}
        accessibilityHint="Shows overall and shared game statistics"
        accessibilityState={{ expanded }}
        onPress={onToggle}
      >
        <XStack padding="$3" gap="$3" alignItems="center">
          <YStack
            width={44}
            height={44}
            borderRadius={22}
            backgroundColor="$primaryLight"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="$primary" fontWeight="700" fontSize={20}>
              {[...person.username][0]?.toUpperCase()}
            </Text>
          </YStack>
          <YStack flex={1} minWidth={0} gap="$1">
            <Text color="$textPrimary" fontWeight="700" fontSize={16}>{person.username}</Text>
            {data ? (
              <>
                <Text color="$textMuted">{data.shared.shared_games} games together</Text>
                {!expanded ? (
                  <Text color="$textMuted">
                    Overall: {data.target.games_participated} games · {formatDrinks(data.target.total_drinks)} drinks
                  </Text>
                ) : null}
              </>
            ) : view.checking ? (
              <Text color="$textMuted">Checking access…</Text>
            ) : null}
          </YStack>
          <Text color="$primary" fontSize={22} aria-hidden>
            {expanded ? '⌃' : '›'}
          </Text>
        </XStack>
      </Pressable>

      {view.error ? (
        <YStack paddingHorizontal="$3" paddingBottom="$3" gap="$2">
          <Text color="$textPrimary" fontWeight="700" accessibilityRole="alert">
            Friend stats couldn&apos;t load
          </Text>
          <Text color="$textMuted">
            {personalAvailable ? 'Your stats are still available.' : 'Your game history is still available.'}
          </Text>
          <Text color="$textMuted">{view.error}</Text>
          <ShellActionButton
            role="button"
            label={`Retry ${person.username}`}
            variant="surface"
            size="small"
            widthMode="fit"
            onPress={() => { void view.refresh(); }}
          />
        </YStack>
      ) : null}

      {expanded && data ? (
        <YStack paddingHorizontal="$3" paddingBottom="$3" gap="$3">
          <Text color="$textPrimary" fontWeight="700" accessibilityRole="header">Overall totals</Text>
          <ComparisonTable viewer={data.viewer} target={data.target} username={data.target.username} />
          <YStack gap="$2" borderTopWidth={1} borderColor="$borderColor" paddingTop="$3">
            <Text color="$textPrimary" fontWeight="700" accessibilityRole="header">
              When you played together
            </Text>
            <Text color="$textMuted">Only your {data.shared.shared_games} shared games</Text>
            <ComparisonTable
              username={data.target.username}
              viewer={{
                games_participated: data.shared.shared_games,
                total_drinks: data.shared.viewer_total_drinks,
                average_drinks: data.shared.viewer_average_drinks,
              }}
              target={{
                games_participated: data.shared.shared_games,
                total_drinks: data.shared.target_total_drinks,
                average_drinks: data.shared.target_average_drinks,
              }}
            />
            {!data.shared.shared_games ? (
              <Text color="$textMuted">No completed online games together yet.</Text>
            ) : null}
            <Text color="$textMuted" fontSize={12}>
              Early leavers count once, using their drinks recorded when they left.
            </Text>
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  );
}

interface HistoryStatisticsProps {
  history: GameSession[];
  friends: ReturnType<typeof useFriends>;
  targetId: string;
  onSelect: (id: string) => void;
}

export default function HistoryStatistics({ history, friends, targetId, onSelect }: HistoryStatisticsProps): React.ReactElement {
  const personal = usePersonalHistoryStats();
  const recent = new Map<string, number>();

  history.forEach((game) => {
    const timestamp = getHistoryTimestamp(game.date);
    if (timestamp === null) return;

    game.players.forEach((player) => {
      if (player.membershipType === 'registered' && player.accountId) {
        recent.set(player.accountId, Math.max(recent.get(player.accountId) ?? 0, timestamp));
      }
    });
  });

  const people = friends.items
    .filter((person) => person.relationship === 'friends')
    .sort((a, b) => (recent.get(b.account_id) ?? 0) - (recent.get(a.account_id) ?? 0)
      || a.username.localeCompare(b.username));
  const selectedFriendPending = Boolean(
    targetId && !people.some((person) => person.account_id === targetId) && friends.list.isFetching,
  );

  async function refresh(): Promise<void> {
    if (friends.id) await invalidateSocialHistory(friends.id);
    await Promise.all([personal.refresh(), friends.refresh()]);
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={(
        <RefreshControl
          refreshing={personal.loading}
          onRefresh={() => { void refresh(); }}
        />
      )}
    >
      <YStack gap="$5">
        <YStack gap="$3">
          <Text accessibilityRole="header" fontSize={22} fontWeight="700" color="$textPrimary">
            Your stats
          </Text>
          <Text color="$textMuted">Completed online games · All time</Text>
          <XStack
            backgroundColor="$surface"
            borderRadius="$3"
            padding="$3"
            gap="$2"
            flexWrap="wrap"
            borderWidth={1}
            borderColor="$borderColor"
          >
            {[
              ['Games played', personal.data ? String(personal.data.games_participated) : '—'],
              ['Recorded drinks', formatDrinks(personal.data?.total_drinks)],
              ['Per game', formatDrinks(personal.data?.average_drinks)],
            ].map(([label, value]) => (
              <YStack key={label} flex={1} minWidth={85} gap="$1" alignItems="center" paddingVertical="$2">
                <Text color="$textPrimary" fontSize={26} fontWeight="700">{value}</Text>
                <Text color="$textMuted" fontSize={12} textAlign="center">{label}</Text>
              </YStack>
            ))}
          </XStack>
          {!personal.enabled ? (
            <Text color="$textMuted">Sign in to see your online statistics.</Text>
          ) : null}
          {personal.loading && !personal.data ? (
            <Text color="$textMuted">Loading your statistics…</Text>
          ) : null}
          {personal.error ? (
            <YStack gap="$2">
              <Text color="$textMuted" accessibilityRole="alert">{personal.error}</Text>
              <ShellActionButton
                role="button"
                label="Retry your stats"
                variant="surface"
                size="small"
                widthMode="fit"
                onPress={() => { void personal.refresh(); }}
              />
            </YStack>
          ) : null}
        </YStack>

        <YStack gap="$2">
          <Text accessibilityRole="header" fontSize={18} fontWeight="700" color="$textPrimary">
            Friends
          </Text>
          <Text color="$textMuted">Tap a friend to compare</Text>
          {selectedFriendPending ? (
            <Text color="$textMuted" accessibilityLiveRegion="polite">Loading selected friend…</Text>
          ) : null}
          {friends.list.isFetching && !people.length ? (
            <Text color="$textMuted">Loading friends…</Text>
          ) : null}
          {friends.list.error ? (
            <YStack gap="$2">
              <Text color="$textPrimary" accessibilityRole="alert">Friend stats couldn&apos;t load</Text>
              <Text color="$textMuted">
                {personal.data ? 'Your stats are still available.' : 'Your game history is still available.'}
              </Text>
              <ShellActionButton
                role="button"
                variant="surface"
                label="Retry friends"
                size="small"
                widthMode="fit"
                onPress={() => { void friends.refresh(); }}
              />
            </YStack>
          ) : null}
          {people.map((person) => (
            <FriendStatistics
              key={person.account_id}
              person={person}
              personalAvailable={!!personal.data}
              expanded={targetId === person.account_id}
              onToggle={() => onSelect(targetId === person.account_id ? '' : person.account_id)}
            />
          ))}
          {!people.length && !friends.list.isFetching && !friends.list.error ? (
            <Text color="$textMuted">Your friends&apos; summaries will appear here when you add friends.</Text>
          ) : null}
          {friends.list.hasNextPage ? (
            <ShellActionButton
              role="button"
              variant="surface"
              label="More friends"
              widthMode="fit"
              size="small"
              disabled={friends.list.isFetching}
              onPress={() => { void friends.list.fetchNextPage(); }}
            />
          ) : null}
        </YStack>
        <Text color="$textMuted" fontSize={12}>Ongoing and local games aren&apos;t included.</Text>
      </YStack>
    </ScrollView>
  );
}
