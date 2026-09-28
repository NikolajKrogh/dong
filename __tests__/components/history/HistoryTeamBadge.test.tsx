import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

const mockGetHardcodedTeamLogoOnly = jest.fn();
const mockGetTeamLogo = jest.fn();

jest.mock("react-native", () => ({
  Image: "Image",
  Text: "Text",
  View: "View",
}));

jest.mock("../../../utils/teamLogos", () => ({
  getHardcodedTeamLogoOnly: mockGetHardcodedTeamLogoOnly,
  getTeamLogo: mockGetTeamLogo,
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    backgroundLight: "#f8f9fa",
    borderSubtle: "#e9ecef",
    textSecondary: "#333333",
  }),
}));

describe("HistoryTeamBadge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockResolvedValue(null);
  });

  it("shows initials when no hardcoded or cached logo is available", () => {
    const HistoryTeamBadge =
      require("../../../components/history/HistoryTeamBadge").default;

    const renderer = actCreate(
      React.createElement(HistoryTeamBadge, { teamName: "Manchester United" }),
    );

    expect(JSON.stringify(renderer.toJSON())).toContain("MU");
    expect(renderer.root.findByType("View" as React.ElementType).props.style).toEqual(
      expect.objectContaining({ width: 34, height: 34 }),
    );
  });

  it("replaces a failed cached logo with initials in the same badge size", async () => {
    mockGetTeamLogo.mockResolvedValue("https://example.test/logo.png");
    const HistoryTeamBadge =
      require("../../../components/history/HistoryTeamBadge").default;

    const renderer = actCreate(
      React.createElement(HistoryTeamBadge, { teamName: "Manchester United" }),
    );
    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    const badgeView = renderer.root.findByType("View" as React.ElementType);
    const badgeStyle = badgeView.props.style;
    const image = renderer.root.findByType("Image" as React.ElementType);
    TestRenderer.act(() => image.props.onError());

    expect(JSON.stringify(renderer.toJSON())).toContain("MU");
    expect(renderer.root.findByType("View" as React.ElementType).props.style).toEqual(badgeStyle);
  });
});
