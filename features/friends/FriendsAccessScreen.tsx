import React from 'react';
import { Text, YStack } from 'tamagui';
import { ShellActionButton } from '../../components/ui';
import { useAccountAuth } from '../account';
import { buildAccountAuthRoute } from '../account/accountAuthRoutes';

export default function FriendsAccessScreen({ returnTo }: { returnTo: string }) {
  const { status } = useAccountAuth();
  const loading = status === 'loading' || status === 'ready';
  const needsUsername = status === 'needsUsername';
  let message = 'Sign in to manage friends.';
  if (loading) message = 'Loading your account…';
  else if (needsUsername) message = 'Choose a username to manage friends.';
  return <YStack gap="$3">
    <Text color="$textMuted">{message}</Text>
    {!loading ? <ShellActionButton label={needsUsername ? 'Choose username' : 'Sign in'}
      href={buildAccountAuthRoute(needsUsername ? '/auth/onboarding' : '/auth', returnTo) as never} /> : null}
    <ShellActionButton variant="surface" label="Home" href="/" />
  </YStack>;
}
