import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { AVAILABLE_LEAGUES, type LeagueEndpoint } from "../../constants/leagues";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";
import type { Match } from "../../store/store";
import { useColors } from "../../styles/theme";
import { SelectableMatchList } from "../matchSelection/SelectableMatchList";

interface Props {
  matches: Match[];
  selectedMatchIds: string[];
  disabled: boolean;
  onToggleMatch: (id: string) => void;
}

function LeagueHeading({ league }: { league: LeagueEndpoint }): React.JSX.Element {
  const { logoSource } = useLeagueLogo(league.name, league.code);
  const colors = useColors();
  return <View style={styles.heading}>
    {logoSource ? <Image source={logoSource} style={styles.logo} /> : null}
    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{league.name}</Text>
  </View>;
}

export default function LeagueMatchSections({ matches, selectedMatchIds, disabled, onToggleMatch }: Props): React.JSX.Element {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const code = match.sourceLeagueCode ?? "";
    const group = groups.get(code) ?? [];
    group.push(match);
    groups.set(code, group);
  }
  return <>
    {[...groups].map(([code, group]) => {
      const league = AVAILABLE_LEAGUES.find(item => item.code === code);
      return <View key={code}>
        {league ? <LeagueHeading league={league} /> : null}
        <SelectableMatchList matches={group} selectedMatchIds={selectedMatchIds}
          onToggleMatch={onToggleMatch} disabledMatchIds={disabled ? group.map(match => match.id) : undefined}
          testIDPrefix="SetupPoolMatch" />
      </View>;
    })}
  </>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 12 },
  logo: { width: 28, height: 28, resizeMode: "contain" },
  title: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
});
