import React from 'react';
import { useRouter } from 'expo-router';
import { Text, YStack } from 'tamagui';
import { ShellActionButton } from '../../components/ui';
import { useAccountAuth } from '../../hooks/useAccountAuth';
import { buildAccountAuthRoute } from '../../utils/accountAuthRoutes';

export default function FriendsAccessScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const { status } = useAccountAuth();
  const loading = status === 'loading' || status === 'ready';
  const needsUsername = status === 'needsUsername';
  return <YStack gap="$3">
    <Text color="$textMuted">{loading ? 'Loading your account…' : needsUsername ? 'Choose a username to manage friends.' : 'Sign in to manage friends.'}</Text>
    {!loading ? <ShellActionButton role="button" label={needsUsername ? 'Choose username' : 'Sign in'}
      onPress={() => router.push(buildAccountAuthRoute(needsUsername ? '/auth/onboarding' : '/auth', returnTo) as never)} /> : null}
    <ShellActionButton role="button" variant="surface" label="Home" onPress={() => router.replace('/')} />
  </YStack>;
}
