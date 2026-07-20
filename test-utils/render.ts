import type { ReactElement } from "react";
import TestRenderer from "react-test-renderer";

/**
 * React 19's react-test-renderer defers the initial commit until it runs
 * inside act() — a bare TestRenderer.create() leaves `.root` inaccessible
 * and closures capturing render output unset. This wraps that flush.
 */
export const actCreate = (
  element: ReactElement,
): TestRenderer.ReactTestRenderer => {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
};
