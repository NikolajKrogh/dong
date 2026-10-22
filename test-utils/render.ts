import { createElement, type ReactElement } from "react";
import TestRenderer from "react-test-renderer";

const mounted = new Set<TestRenderer.ReactTestRenderer>();

afterEach(async () => {
  await TestRenderer.act(async () => {
    for (const renderer of mounted) renderer.unmount();
    mounted.clear();
  });
});

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
  mounted.add(renderer);
  return renderer;
};

/** Mount a hook with the same commit and cleanup rules as component tests. */
export const renderHook = <Result>(useHook: () => Result) => {
  let latest!: Result;
  const Probe = () => {
    latest = useHook();
    return null;
  };
  const renderer = actCreate(createElement(Probe));
  return {
    renderer,
    getLatest: () => latest,
    rerender: () => renderer.update(createElement(Probe)),
  };
};
