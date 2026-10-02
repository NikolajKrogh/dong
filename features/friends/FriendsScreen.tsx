import React, { useState } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { ShellActionButton } from '../../components/ui';
import SettingsPage from '../../components/preferences/SettingsPage';
import FriendSearchField from './FriendSearchField';
import PeopleList from './PeopleList';
import RequestsPanel from './RequestsPanel';
import { useFriends } from './useFriends';
export default function FriendsScreen() {
  const router = useRouter();
  const friends = useFriends('friends');
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await friends.refresh(); } finally { setRefreshing(false); } };
  return <SettingsPage title="Friends" onBack={() => router.replace('/userPreferences/profile')} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} />}>
    {!friends.enabled ? <Text color="$textMuted">Sign in and choose a username to manage friends.</Text> : <YStack gap="$4">
      <XStack gap="$2" alignItems="center">
        <YStack flex={1}><FriendSearchField onPress={() => router.push('/friends/search' as never)} /></YStack>
        <ShellActionButton role="button" accessibilityLabel="Friends menu" accessibilityState={{ expanded: menu }} widthMode="fit" variant="surface" label="⋮" onPress={() => setMenu(!menu)} />
      </XStack>
      {menu ? <ShellActionButton role="button" variant="surface" label="Blocked accounts" onPress={() => { setMenu(false); router.push('/friends/blocked' as never); }} /> : null}
      <XStack backgroundColor="$surface" borderRadius="$3" borderWidth={1} borderColor="$borderColor" padding="$1" gap="$1">
        {(['friends', 'requests'] as const).map(value => <ShellActionButton key={value} role="tab" accessibilityState={{ selected: tab === value }} flex={1} widthMode="fit" variant="surface" borderWidth={0} backgroundColor={tab === value ? '$primaryLight' : '$surface'} label={value === 'friends' ? 'Friends' : 'Requests'} onPress={() => setTab(value)} />)}
      </XStack>
      {friends.actionError ? <Text color="$danger" accessibilityRole="alert">{friends.actionError}</Text> : null}
      {tab === 'requests' ? <RequestsPanel /> : <YStack gap="$3">
        {!friends.list.isFetching && !friends.list.error && friends.items.length === 0 ? <YStack alignItems="center" gap="$3" paddingVertical="$6">
          <Text color="$textPrimary" fontSize={22} fontWeight="700" textAlign="center">Better games with friends</Text>
          <Text color="$textMuted" textAlign="center">Find your friends by username.</Text>
          <ShellActionButton role="button" widthMode="fit" label="Find friends" onPress={() => router.push('/friends/search' as never)} />
        </YStack> : <><Text color="$textPrimary" fontWeight="700" fontSize={18}>Your friends</Text><PeopleList items={friends.items} loading={friends.list.isFetching} error={friends.list.error} empty="No friends yet." busy={friends.busy} onAction={friends.act} loadMore={friends.list.hasNextPage ? () => { void friends.list.fetchNextPage(); } : undefined} /></>}
        <Text color="$textMuted" textAlign="center" fontSize={13} paddingTop="$4">Pull down to refresh</Text>
      </YStack>}
    </YStack>}
  </SettingsPage>;
}
