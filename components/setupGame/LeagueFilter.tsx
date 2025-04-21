import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../app/style/setupGameStyles";
import { ImageSourcePropType } from "react-native";
import { getCachedLeagueLogo } from "../../utils/teamLogos";

// Define a type for the league logos
interface LeagueLogos {
  [key: string]: ImageSourcePropType;
}

// League logo mapping
const LEAGUE_LOGOS: LeagueLogos = {
  "Premier League": require("../../assets/images/leagues/premier-league.png"),
  Championship: require("../../assets/images/leagues/championship.png"),
  Bundesliga: require("../../assets/images/leagues/bundesliga.png"),
  "La Liga": require("../../assets/images/leagues/la-liga.png"),
  "Serie A": require("../../assets/images/leagues/serie-a.png"),
  "Ligue 1": require("../../assets/images/leagues/ligue-1.png"),
  Superliga: require("../../assets/images/leagues/superliga.png"),
};

interface LeagueFilterProps {
  availableLeagues: string[];
  selectedLeagues: string[];
  handleLeagueChange: (league: string) => void;
}

const LeagueFilter: React.FC<LeagueFilterProps> = ({
  availableLeagues,
  selectedLeagues,
  handleLeagueChange,
}) => {
  const [isLeagueExpanded, setIsLeagueExpanded] = useState(false);

  // Maximum number of badges to show before collapsing (when > 3 are selected)
  const MAX_VISIBLE_BADGES_WHEN_COLLAPSED = 2;

  const getLeagueLogo = (league: string): ImageSourcePropType | undefined => {
    // First try to get the logo from our local assets
    const localLogo = LEAGUE_LOGOS[league];
    if (localLogo) {
      return localLogo;
    }

    // If no local logo found, try to get it from API cache
    const cachedApiLogo = getCachedLeagueLogo(league);
    if (cachedApiLogo) {
      return { uri: cachedApiLogo };
    }

    // No logo found in either source
    return undefined;
  };

  // Function to render the badges in the header
  const renderBadges = () => {
    const numSelected = selectedLeagues.length;

    if (numSelected === 0) {
      return <Text style={styles.noFiltersText}>No leagues selected</Text>;
    }

    // If 1, 2, or 3 leagues are selected, show them all
    if (numSelected <= 3) {
      return selectedLeagues.map((league) => {
        const logoSource = getLeagueLogo(league);
        return (
          <View key={league} style={styles.filterBadge}>
            {logoSource ? (
              <Image source={logoSource} style={styles.badgeLogo} />
            ) : (
              <Text style={styles.filterBadgeText}>{league}</Text>
            )}
          </View>
        );
      });
    }

    // If 4 or more leagues are selected, show 2 logos and a count badge
    return (
      <>
        {selectedLeagues.slice(0, MAX_VISIBLE_BADGES_WHEN_COLLAPSED).map((league) => {
          const logoSource = getLeagueLogo(league);
          return (
            <View key={league} style={styles.filterBadge}>
              {logoSource ? (
                <Image source={logoSource} style={styles.badgeLogo} />
              ) : (
                <Text style={styles.filterBadgeText}>{league}</Text>
              )}
            </View>
          );
        })}
        <View style={[styles.filterBadge, styles.countBadge]}>
          <Text style={styles.countBadgeText}>
            +{numSelected - MAX_VISIBLE_BADGES_WHEN_COLLAPSED}
          </Text>
        </View>
      </>
    );
  };

  return (
    <View style={styles.filterCard}>
      <TouchableOpacity
        style={styles.filterCardHeader}
        onPress={() => setIsLeagueExpanded(!isLeagueExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.filterCardContent}>
          <View style={styles.filterTitleContainer}>
            <Ionicons name="football-outline" size={20} color="#1976d2" />
            <Text style={styles.filterTitle}>Choose Leagues</Text>
          </View>

          <View style={styles.filterBadgesSection}>
            <View style={styles.filterBadgesContainer}>{renderBadges()}</View>

            <View style={styles.indicatorContainer}>
              <Ionicons
                name={isLeagueExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color="#777"
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {isLeagueExpanded && (
        <View style={styles.expandedContent}>
          <View style={styles.leagueGrid}>
            {availableLeagues.map((league) => {
              const logoSource = getLeagueLogo(league);
              return (
                <TouchableOpacity
                  key={league}
                  style={[
                    styles.leagueGridItem,
                    selectedLeagues.includes(league) &&
                      styles.selectedLeagueChip,
                  ]}
                  onPress={() => handleLeagueChange(league)}
                >
                  {logoSource ? (
                    <View style={styles.chipContainer}>
                      <Image source={logoSource} style={styles.chipLogo} />
                      <Text
                        style={[
                          styles.leagueChipText,
                          selectedLeagues.includes(league) &&
                            styles.selectedLeagueChipText,
                        ]}
                      >
                        {league}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.leagueChipText,
                        selectedLeagues.includes(league) &&
                          styles.selectedLeagueChipText,
                      ]}
                    >
                      {league}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

export default LeagueFilter;