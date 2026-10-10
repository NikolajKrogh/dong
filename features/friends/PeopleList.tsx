import React from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { ShellActionButton } from '../../components/ui';
import FriendActions from './FriendActions';
import type { FriendAction, Person } from './friendsRepository';

interface PeopleListProps {
  items: Person[];
  loading: boolean;
  fetching?: boolean;
  error: Error | null;
  empty: string;
  busyAccountId: string | null;
  onAction: (action: FriendAction, person: Person) => Promise<void>;
  onOpenShared?: (accountId: string) => void;
  loadMore?: () => void;
  loadingMore?: boolean;
}

export default function PeopleList({
  items,
  loading,
  fetching = loading,
  error,
  empty,
  busyAccountId,
  onAction,
  onOpenShared,
  loadMore,
  loadingMore = false,
}: PeopleListProps) {
  return (
    <YStack gap="$3">
      {loading ? <Text color="$textMuted">Loading…</Text> : null}
      {error ? <Text color="$danger" accessibilityRole="alert">{error.message}</Text> : null}
      {!loading && !error && items.length === 0 ? (
        <Text color="$textMuted" paddingVertical="$4" textAlign="center">{empty}</Text>
      ) : null}
      {items.map((person) => (
        <YStack
          key={person.account_id}
          backgroundColor="$primaryLighter"
          borderRadius="$3"
          padding="$3"
        >
          <XStack gap="$3" alignItems="center" flexWrap="wrap">
            <YStack
              backgroundColor="$primaryLight"
              borderRadius={22}
              width={44}
              height={44}
              alignItems="center"
              justifyContent="center"
            >
              <Text color="$primary" fontWeight="700" fontSize={20}>
                {[...person.username][0]?.toUpperCase() || "?"}
              </Text>
            </YStack>
            <YStack flex={1} minWidth={80}>
              <Text color="$textPrimary" fontWeight="700" fontSize={16}>{person.username}</Text>
            </YStack>
            <FriendActions
              person={person}
              busy={busyAccountId !== null}
              working={busyAccountId === person.account_id}
              onAction={onAction}
            />
          </XStack>
          {person.relationship === 'friends' && onOpenShared ? (
            <ShellActionButton
              role="button"
              variant="surface"
              label={`You & ${person.username}`}
              onPress={() => onOpenShared(person.account_id)}
            />
          ) : null}
        </YStack>
      ))}
      {loadMore ? (
        <ShellActionButton
          role="button"
          variant="surface"
          label={loadingMore ? 'Loading…' : 'Load more'}
          disabled={fetching}
          onPress={loadMore}
        />
      ) : null}
    </YStack>
  );
}
