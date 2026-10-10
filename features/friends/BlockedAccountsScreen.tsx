import React from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'tamagui';
import SettingsPage from '../../components/preferences/SettingsPage';
import { ShellActionButton } from '../../components/ui';
import PeopleList from './PeopleList';
import { useFriends } from './useFriends';
export default function BlockedAccountsScreen() {
  const router = useRouter(); const friends = useFriends('blocks');
  return <SettingsPage title="Blocked accounts" onBack={() => router.replace('/friends' as never)}>
    {!friends.enabled ? <Text color="$textMuted">Sign in to manage blocked accounts.</Text> : <>
      <Text color="$textMuted">Unblocking allows new requests. It does not restore a friendship.</Text>
      <ShellActionButton role="button" variant="surface" label="Refresh" onPress={() => { void friends.refresh(); }} />
      {friends.actionError ? <Text color="$danger" accessibilityRole="alert">{friends.actionError}</Text> : null}
      <PeopleList
        items={friends.items}
        loading={friends.list.isLoading}
        fetching={friends.list.isFetching}
        error={friends.list.error}
        empty="No blocked accounts."
        busyAccountId={friends.busy}
        onAction={friends.act}
        loadMore={friends.list.hasNextPage ? () => { void friends.list.fetchNextPage(); } : undefined}
        loadingMore={friends.list.isFetchingNextPage}
      />
    </>}
  </SettingsPage>;
}
