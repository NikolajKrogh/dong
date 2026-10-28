import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, YStack } from 'tamagui';
import { SettingsPage } from '../preferences';
import { normalizeAccountUsername } from '../account';
import FriendSearchField from './FriendSearchField';
import PeopleList from './PeopleList';
import { useFriends } from './useFriends';
import FriendsAccessScreen from './FriendsAccessScreen';
import { parseFriendsTab, type RouteParams } from '../../platform/navigation/routeState';
export default function FindFriendsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as RouteParams;
  const tab = parseFriendsTab(params);
  const [input, setInput] = useState('');
  const [prefix, setPrefix] = useState('');
  const friends = useFriends('friends', prefix);
  const openShared = useCallback((accountId: string) => {
    router.push({ pathname: '/history', params: { friendId: accountId } });
  }, [router]);
  useEffect(() => { const timer = setTimeout(() => setPrefix(input), 300); return () => clearTimeout(timer); }, [input]);
  const short = [...(normalizeAccountUsername(prefix) ?? '')].length < 3;
  return <SettingsPage title="Find friends" onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/friends', params: { tab } })} refreshControl={<RefreshControl refreshing={friends.search.isFetching} onRefresh={() => { void friends.refresh(); }} />}>
    {!friends.enabled ? <FriendsAccessScreen returnTo={"/friends/search?tab=" + tab} /> : <YStack gap="$3">
      <FriendSearchField value={input} onChange={setInput} onSubmit={() => { if (prefix === input && !short) void friends.search.refetch(); else setPrefix(input); }} />
      <Text color="$textMuted" fontSize={14}>{short ? 'Enter at least 3 characters to find friends.' : `${friends.results.length} ${friends.results.length === 1 ? 'result' : 'results'}`}</Text>
      {friends.results.length === 20 ? <Text color="$textMuted" fontSize={14}>Refine your search to see more specific matches.</Text> : null}
      {friends.actionError ? <Text color="$danger" accessibilityRole="alert">{friends.actionError}</Text> : null}
      {!short ? (
        <PeopleList
          items={friends.results}
          loading={friends.search.isLoading}
          error={friends.search.error}
          empty="No matching accounts."
          busyAccountId={friends.busy}
          onAction={friends.act}
          onOpenShared={openShared}
        />
      ) : null}
    </YStack>}
  </SettingsPage>;
}
