import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { getHardcodedTeamLogoOnly, getTeamLogo } from "../../utils/teamLogos";
import { useColors } from "../../styles/theme";

interface HistoryTeamBadgeProps {
  teamName: string;
  size?: number;
}

/** A team logo that falls back to initials when no usable logo is available. */
const HistoryTeamBadge: React.FC<HistoryTeamBadgeProps> = ({
  teamName,
  size = 34,
}) => {
  const colors = useColors();
  const normalizedName = teamName.trim().toLocaleLowerCase();
  const [cachedLogo, setCachedLogo] = useState<{
    teamName: string;
    uri: string;
  } | null>(null);
  const [failedTeamName, setFailedTeamName] = useState<string | null>(null);
  const hardcodedLogo: ImageSourcePropType | null = teamName.trim()
    ? getHardcodedTeamLogoOnly(teamName)
    : null;

  useEffect(() => {
    let isCurrent = true;

    if (!normalizedName || hardcodedLogo) return () => {
      isCurrent = false;
    };

    void getTeamLogo(teamName)
      .then((uri) => {
        if (isCurrent && uri) {
          setCachedLogo({ teamName: normalizedName, uri });
        }
      })
      .catch(() => {
        // Missing cached logos use the initials fallback below.
      });

    return () => {
      isCurrent = false;
    };
  }, [hardcodedLogo, normalizedName, teamName]);

  const cachedSource =
    cachedLogo?.teamName === normalizedName ? { uri: cachedLogo.uri } : null;
  const imageSource = hardcodedLogo ?? cachedSource;
  const showFallback = !imageSource || failedTeamName === normalizedName;
  const initials = teamName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase() || "?";

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
      accessible={false}
    >
      {showFallback ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: Math.max(10, Math.round(size * 0.32)),
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {initials}
        </Text>
      ) : (
        <Image
          source={imageSource as ImageSourcePropType}
          resizeMode="contain"
          onError={() => setFailedTeamName(normalizedName)}
          style={{ width: size * 0.82, height: size * 0.82 }}
          accessible={false}
        />
      )}
    </View>
  );
};

export default HistoryTeamBadge;
