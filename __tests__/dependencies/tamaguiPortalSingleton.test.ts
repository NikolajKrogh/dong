import { createRequire } from "node:module";
import path from "node:path";

describe("Tamagui portal dependency", () => {
  it("resolves the provider and Sheet portal imports to one physical module", () => {
    const rootPortal = require.resolve("@tamagui/portal/package.json");
    const tamaguiPackage = require.resolve("tamagui/package.json");
    const resolveFromTamagui = createRequire(
      path.join(path.dirname(tamaguiPackage), "portal-resolution.cjs"),
    );

    expect(resolveFromTamagui.resolve("@tamagui/portal/package.json")).toBe(
      rootPortal,
    );
  });
});
