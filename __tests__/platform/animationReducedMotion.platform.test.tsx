import React from 'react';
import { act } from 'react-test-renderer';
import { actCreate } from '../../test-utils/render';
import { PlatformAnimation } from '../../platform/animation/PlatformAnimation.native';
const mockRemove = jest.fn();
const mockReadReducedMotion = jest.fn(async () => true);
let mockChange: (value: boolean) => void;
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text',
  AccessibilityInfo: {
    isReduceMotionEnabled: () => mockReadReducedMotion(),
    addEventListener: (_name: string, callback: (value: boolean) => void) => { mockChange = callback; return { remove: mockRemove }; },
  },
}));
jest.mock('../../styles/theme', () => ({ useColors: () => ({ textPrimary: '#111' }) }));
jest.mock('../../platform/animation/fallbacks', () => ({ getAnimationFallback: () => ({ useNativeRenderer: true, accessibilityLabel: 'Loading' }) }));
jest.mock('lottie-react-native', () => 'LottieView');
it('uses static native content for reduced motion and follows setting changes', async () => {
  const tree = actCreate(<PlatformAnimation kind="loading" source="fixture-animation" loop />);
  await act(async () => { await Promise.resolve(); });
  expect(tree.root.findAll((node) => String(node.type) === 'LottieView')).toHaveLength(0);
  act(() => mockChange(false));
  expect(tree.root.findAll((node) => String(node.type) === 'LottieView')).toHaveLength(1);
  act(() => mockChange(true));
  expect(tree.root.findAll((node) => String(node.type) === 'LottieView')).toHaveLength(0);
  act(() => tree.unmount());
  expect(mockRemove).toHaveBeenCalledTimes(1);
});


it('keeps a newer setting event when the initial preference read resolves late', async () => {
  let resolveInitial!: (value: boolean) => void;
  mockReadReducedMotion.mockImplementationOnce(() => new Promise<boolean>(resolve => { resolveInitial = resolve; }));
  const tree = actCreate(<PlatformAnimation kind="loading" source="fixture-animation" loop />);
  act(() => mockChange(true));
  await act(async () => { resolveInitial(false); await Promise.resolve(); });
  expect(tree.root.findAll((node) => String(node.type) === 'LottieView')).toHaveLength(0);
  act(() => tree.unmount());
});
