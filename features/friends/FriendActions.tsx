import React, { useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, TouchableOpacity, View } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { ShellActionButton, ShellCard } from '../../components/ui';
import { actionsForPerson, type FriendAction, type Person } from './friendsRepository';

const labels: Record<FriendAction, string> = { send: 'Send request', accept: 'Accept', decline: 'Decline', cancel: 'Cancel request', unfriend: 'Unfriend', block: 'Block', unblock: 'Unblock' };
interface FriendActionsProps {
  person: Person;
  busy: boolean;
  working?: boolean;
  onAction: (action: FriendAction, person: Person) => Promise<void>;
}

export default function FriendActions({ person, busy, working = false, onAction }: FriendActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<FriendAction | null>(null);
  const trigger = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const actions = actionsForPerson(person);
  const close = () => {
    setConfirmation(null); setMenuOpen(false);
    requestAnimationFrame(() => {
      if (Platform.OS === 'web') (trigger.current as unknown as HTMLElement | null)?.focus?.();
      else { const handle = findNodeHandle(trigger.current); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }
    });
  };
  const choose = (action: FriendAction) => {
    if (action === 'block' || action === 'unfriend') setConfirmation(action);
    else { setMenuOpen(false); void onAction(action, person); }
  };
  return <YStack gap="$2">
    <XStack gap="$2" flexWrap="wrap" alignItems="center">
      {person.relationship === 'outgoing' ? <Text color="$textMuted" fontSize={14}>Pending</Text> : null}
      {actions.filter(action => ['send','accept','decline','unblock'].includes(action)).map(action =>
        <ShellActionButton key={action} widthMode="fit" size="small" role="button" accessibilityLabel={`${labels[action]} ${person.username}`} disabled={busy}
          label={working ? 'Working…' : labels[action]} variant={action === 'decline' ? 'surface' : 'primary'} onPress={() => choose(action)} />)}
      {actions.some(action => action === 'block' || action === 'unfriend' || action === 'cancel') ?
        <TouchableOpacity ref={trigger} accessibilityRole="button" accessibilityLabel={`More actions for ${person.username}`} accessibilityState={{ expanded: menuOpen, disabled: busy }} disabled={busy}
          onPress={() => setMenuOpen(!menuOpen)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text color="$primary" fontSize={24}>⋮</Text>
        </TouchableOpacity> : null}
    </XStack>
    {menuOpen ? <XStack gap="$2" flexWrap="wrap">
      {actions.filter(action => action === 'block' || action === 'unfriend' || action === 'cancel').map(action =>
        <ShellActionButton role="button" key={action} label={labels[action]} variant="surface" widthMode="fit" size="small" disabled={busy} onPress={() => choose(action)} />)}
    </XStack> : null}
    <Modal transparent visible={confirmation !== null} animationType="fade" onRequestClose={close} onDismiss={close}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <ShellCard accessibilityViewIsModal>
          <YStack gap="$4">
            <Text color="$textPrimary" fontWeight="700" fontSize={22}>{confirmation === 'block' ? 'Block' : 'Unfriend'} {person.username}?</Text>
            <Text color="$textSecondary">{confirmation === 'block' ? 'Requests and friendship access will be stopped. Unblocking will not restore the friendship.' : 'Remove this friendship? Your game history will be kept.'}</Text>
            <XStack gap="$3" flexWrap="wrap">
              <ShellActionButton role="button" widthMode="fit" variant="surface" label="Cancel" onPress={close} />
              <ShellActionButton role="button" widthMode="fit" variant="danger" label={confirmation === 'block' ? 'Block' : 'Unfriend'} disabled={busy}
                onPress={() => { const action = confirmation; close(); if (action) void onAction(action, person); }} />
            </XStack>
          </YStack>
        </ShellCard>
      </View>
    </Modal>
  </YStack>;
}
