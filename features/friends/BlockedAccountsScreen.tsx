import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'tamagui';
import { SettingsPage } from '../preferences';
import { ShellActionButton } from '../../components/ui';
import PeopleList from './PeopleList';
import { useFriends } from './useFriends';
import FriendsAccessScreen from './FriendsAccessScreen';
import { parseFriendsTab, type RouteParams } from '../../platform/navigation/routeState';
export default function BlockedAccountsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as RouteParams;
  const tab = parseFriendsTab(params); const friends = useFriends('blocks');
  return <SettingsPage title="Blocked accounts" onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/friends', params: { tab } })}>
    {!friends.enabled ? <FriendsAccessScreen returnTo={"/friends/blocked?tab=" + tab} /> : <>
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
