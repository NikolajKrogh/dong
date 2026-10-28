import React from 'react';
import { goalToastConfig } from '../../../features/game-progress/GoalToast';

it('removes hidden goal content instead of leaving it in the accessibility tree', () => {
  const hidden = goalToastConfig.success({ isVisible: false, text1: 'Home 1-0 Away' });
  expect(hidden.type).toBe(React.Fragment);
  expect(hidden.props.children).toBeUndefined();
  const visible = goalToastConfig.success({ isVisible: true, text1: 'Home 1-0 Away' }) as React.ReactElement<{ role: string }>;
  expect(visible.props.role).toBe('status');
});
