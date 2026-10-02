import React from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { ShellActionButton } from '../../components/ui';
import FriendActions from './FriendActions';
import type { FriendAction, Person } from './friendsRepository';
export default function PeopleList({ items, loading, error, empty, busy, onAction, loadMore }: {
  items: Person[]; loading: boolean; error: Error | null; empty: string; busy: string | null;
  onAction: (action: FriendAction, person: Person) => Promise<void>; loadMore?: () => void;
}) {
  return <YStack gap="$3">
    {loading ? <Text color="$textMuted">Loading…</Text> : null}
    {error ? <Text color="$danger" accessibilityRole="alert">{error.message} Pull down to try again.</Text> : null}
    {!loading && !error && items.length === 0 ? <Text color="$textMuted" paddingVertical="$4" textAlign="center">{empty}</Text> : null}
    {items.map((person, index) => <YStack key={person.account_id} backgroundColor={(['$primaryLighter', '$successLight', '$warningLight'] as const)[index % 3]} borderRadius="$3" padding="$3">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <YStack backgroundColor={(["#7161B5", "#BD542C", "#187C80"] as const)[index % 3]} borderRadius={22} width={44} height={44} alignItems="center" justifyContent="center">
            <Text color="$textLight" fontWeight="700" fontSize={20}>{[...person.username][0]?.toUpperCase()}</Text>
          </YStack>
          <YStack flex={1} minWidth={80}><Text color="$textPrimary" fontWeight="700" fontSize={16}>{person.username}</Text>
          </YStack>
        <FriendActions person={person} busy={busy !== null} onAction={onAction} />
        </XStack>
    </YStack>)}
    {loadMore ? <ShellActionButton role="button" variant="surface" label={loading ? 'Loading…' : 'Load more'} disabled={loading} onPress={loadMore} /> : null}
  </YStack>;
}
