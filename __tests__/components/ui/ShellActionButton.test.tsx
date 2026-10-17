import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import { ShellActionButton } from '../../../components/ui/ShellActionButton';

jest.mock('expo-router', () => ({ Link: ({ children, href }: any) => require('react').cloneElement(children, { href }) }));

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


it('uses real web commands and destinations and cannot activate disabled actions', () => {
  const original = Platform.OS;
  Platform.OS = 'web';
  try {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(<ShellActionButton label="Save" onPress={onPress} testID="save" />); });
    const command = tree.root.findByType('button-frame' as React.ElementType);
    expect(command.props.render.type).toBe('button');
    expect(command.props.type).toBe('button');
    expect(command.props.testID).toBe('save');
    expect(command.props.role).toBe('button');
    act(() => command.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    act(() => tree.update(<ShellActionButton label="Friends" accessibilityRole="tab" accessibilityState={{ selected: true }} />));
    expect(tree.root.findByType('button-frame' as React.ElementType).props).toMatchObject({ role: 'tab', 'aria-selected': true });
    act(() => tree.update(<ShellActionButton href="/history" label="History" />));
    expect(tree.root.findByType('button-frame' as React.ElementType).props).toMatchObject({ href: '/history' });
    act(() => tree.update(<ShellActionButton href="/history" label="History" disabled onPress={onPress} />));
    expect(tree.root.findByType('button-frame' as React.ElementType).props).toMatchObject({ disabled: true, 'aria-disabled': true });
    expect(tree.root.findByType('button-frame' as React.ElementType).props.onPress).toBeUndefined();
    expect(tree.root.findByType('button-frame' as React.ElementType).props.href).toBeUndefined();
    act(() => tree.unmount());
  } finally { Platform.OS = original; }
});
