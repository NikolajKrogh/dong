import React from 'react';
import { RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import SettingsPage from '../../components/preferences/SettingsPage';
import { isAccountId } from './socialHistoryRepository';
import { useSocialHistory } from './useSocialHistory';
import SharedHistoryContent from './SharedHistoryContent';

export default function SharedHistoryScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ accountId?: string; returnTo?: string }>();
  const targetId = isAccountId(params.accountId) ? params.accountId : '';
  const router = useRouter();
  const view = useSocialHistory(targetId);

  function goBack(): void {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    const destination = params.returnTo === '/friends' ? '/friends' : '/history';
    router.replace(destination);
  }

  return (
    <SettingsPage
      title={view.data ? `You & ${view.data.target.username}` : 'Shared history'}
      onBack={goBack}
      refreshControl={(
        <RefreshControl
          refreshing={view.checking}
          onRefresh={() => { void view.refresh(); }}
        />
      )}
    >
      <SharedHistoryContent view={view} />
    </SettingsPage>
  );
}
