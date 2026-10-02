import React from 'react';
import { TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { XStack } from 'tamagui';
import { useColors } from '../../styles/theme';

export default function FriendSearchField({ value, onChange, onSubmit, onPress }: {
  value?: string; onChange?: (value: string) => void; onSubmit?: () => void; onPress?: () => void;
}) {
  const colors = useColors();
  return <XStack alignItems="center" gap="$2" backgroundColor="$surface" borderColor="$borderColor" borderWidth={1} borderRadius="$3" paddingHorizontal="$3" minHeight={48}>
    <Ionicons name="search-outline" size={20} color={colors.textMuted} />
    {onPress ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search by username" onPress={onPress} style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: colors.textMuted, fontSize: 16 }}>Search by username</Text>
    </TouchableOpacity> : <TextInput accessibilityLabel="Search by username" placeholder="Search by username" placeholderTextColor={colors.textMuted}
      value={value ?? ''} onChangeText={onChange} autoCapitalize="none" autoCorrect={false}
      returnKeyType="search" onSubmitEditing={onSubmit} style={{ flex: 1, minWidth: 0, paddingVertical: 12, color: colors.textPrimary, fontSize: 16 }} />}
    {value ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange?.('')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="close-circle" size={20} color={colors.textMuted} />
    </TouchableOpacity> : null}
  </XStack>;
}
