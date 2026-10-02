import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import { ShellActionButton } from '../../../components/ui/ShellActionButton';

jest.mock('tamagui', () => {
  const React = require('react');
  return {
    XStack: 'button-frame', Text: 'button-label',
    styled: (component: string) => (props: Record<string, unknown>) => React.createElement(component, props),
  };
});

it('maps accessibility props to ARIA on web and preserves native props on Android', () => {
  const original = Platform.OS;
  try {
    for (const platform of ['web', 'android'] as const) {
      Platform.OS = platform;
      let tree!: TestRenderer.ReactTestRenderer;
      act(() => { tree = TestRenderer.create(<ShellActionButton label="Menu" accessibilityLabel="Friends menu" accessibilityState={{ expanded: true, selected: false }} />); });
      const props = tree.root.findByType('button-frame' as React.ElementType).props;
      if (platform === 'web') {
        expect(props['aria-label']).toBe('Friends menu');
        expect(props['aria-expanded']).toBe(true);
        expect(props['aria-selected']).toBe(false);
        expect(props).not.toHaveProperty('accessibilityLabel');
        expect(props).not.toHaveProperty('accessibilityState');
      } else {
        expect(props.accessibilityLabel).toBe('Friends menu');
        expect(props.accessibilityState).toEqual({ expanded: true, selected: false });
        expect(props).not.toHaveProperty('aria-label');
      }
      act(() => tree.unmount());
    }
  } finally { Platform.OS = original; }
});
