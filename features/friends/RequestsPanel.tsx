import React from 'react';
import { Text, YStack } from 'tamagui';
import PeopleList from './PeopleList';
import { useFriends } from './useFriends';
export default function RequestsPanel() {
  const incoming = useFriends('incoming');
  const outgoing = useFriends('outgoing');
  return <YStack gap="$4">
    {incoming.actionError || outgoing.actionError ? <Text color="$danger" accessibilityRole="alert">{incoming.actionError ?? outgoing.actionError}</Text> : null}
    <Text color="$textPrimary" fontWeight="700" fontSize={18}>Received</Text>
    <PeopleList items={incoming.items} loading={incoming.list.isFetching} error={incoming.list.error} empty="No incoming requests." busy={incoming.busy ?? outgoing.busy} onAction={incoming.act}
      loadMore={incoming.list.hasNextPage ? () => { void incoming.list.fetchNextPage(); } : undefined} />
    <Text color="$textPrimary" fontWeight="700" fontSize={18}>Sent</Text>
    <PeopleList items={outgoing.items} loading={outgoing.list.isFetching} error={outgoing.list.error} empty="No sent requests." busy={incoming.busy ?? outgoing.busy} onAction={outgoing.act}
      loadMore={outgoing.list.hasNextPage ? () => { void outgoing.list.fetchNextPage(); } : undefined} />
  </YStack>;
}
