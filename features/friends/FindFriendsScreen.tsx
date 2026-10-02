import React, { useEffect, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, YStack } from 'tamagui';
import SettingsPage from '../../components/preferences/SettingsPage';
import { normalizeAccountUsername } from '../account';
import FriendSearchField from './FriendSearchField';
import PeopleList from './PeopleList';
import { useFriends } from './useFriends';
export default function FindFriendsScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [prefix, setPrefix] = useState('');
  const friends = useFriends('friends', prefix);
  useEffect(() => { const timer = setTimeout(() => setPrefix(input), 300); return () => clearTimeout(timer); }, [input]);
  const short = [...(normalizeAccountUsername(prefix) ?? '')].length < 3;
  return <SettingsPage title="Find friends" onBack={() => router.replace('/friends' as never)} refreshControl={<RefreshControl refreshing={friends.search.isFetching} onRefresh={() => { void friends.refresh(); }} />}>
    {!friends.enabled ? <Text color="$textMuted">Sign in and choose a username to find friends.</Text> : <YStack gap="$3">
      <FriendSearchField value={input} onChange={setInput} onSubmit={() => { if (prefix === input && !short) void friends.search.refetch(); else setPrefix(input); }} />
      <Text color="$textMuted" fontSize={14}>{short ? 'Enter at least 3 characters to find friends.' : `${friends.results.length} ${friends.results.length === 1 ? 'result' : 'results'}`}</Text>
      {friends.results.length === 20 ? <Text color="$textMuted" fontSize={14}>Refine your search to see more specific matches.</Text> : null}
      {friends.actionError ? <Text color="$danger" accessibilityRole="alert">{friends.actionError}</Text> : null}
      {!short ? <PeopleList items={friends.results} loading={friends.search.isFetching} error={friends.search.error} empty="No matching accounts." busy={friends.busy} onAction={friends.act} /> : null}
    </YStack>}
  </SettingsPage>;
}
