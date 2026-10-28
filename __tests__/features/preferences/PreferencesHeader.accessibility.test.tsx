import React from 'react';
import { actCreate } from '../../../test-utils/render';
import { act } from 'react-test-renderer';
import PreferencesHeader from '../../../features/preferences/PreferencesHeader';
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../../styles/theme', () => ({ useColors: () => ({ surface: '#fff', primary: '#0275d8' }) }));
jest.mock('../../../features/preferences/preferencesStyles', () => ({ createUserPreferencesStyles: () => ({ headerStyles: { header: {}, backButton: {}, headerTitle: {} } }) }));
it('names the Back command and exposes its visible title as a heading', () => {
  const onBack = jest.fn();
  const tree = actCreate(<PreferencesHeader title="Settings" onBack={onBack} />);
  const button = tree.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Back')[0];
  act(() => button.props.onPress());
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(tree.root.findAll((node) => node.props.accessibilityRole === 'header' && node.props.children === 'Settings').length).toBeGreaterThan(0);
  act(() => tree.unmount());
});
