import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import styles from "../../app/style/setupGameStyles";

// Define a type for the league logos
interface LeagueLogos {
  [key: string]: any; // Or be more specific if you know the image type
}

// League logo mapping
const LEAGUE_LOGOS: LeagueLogos = {
  "Premier League": require("../../assets/images/leagues/premier-league.png"),
  "Championship": require("../../assets/images/leagues/championship.png"),
  "Bundesliga": require("../../assets/images/leagues/bundesliga.png"),
  "La Liga": require("../../assets/images/leagues/la-liga.png"),
  "Serie A": require("../../assets/images/leagues/serie-a.png"),
  "Ligue 1": require("../../assets/images/leagues/ligue-1.png"),
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

  const getLeagueLogo = (league: string) => {
    return LEAGUE_LOGOS[league] || null;
  };

  return (
    <>
      <TouchableOpacity
        style={styles.expandableCard}
        onPress={() => setIsLeagueExpanded(!isLeagueExpanded)}
      >
        <View style={styles.expandableCardContent}>
          <View style={styles.expandableCardLeft}>
            <Ionicons name="football-outline" size={20} color="#0275d8" />
            <Text style={styles.expandableCardTitle}>Choose Leauges</Text>
          </View>

          <View style={styles.rightContent}>
            <View style={styles.filterBadgesContainer}>
              {selectedLeagues.map((league) => (
                <View key={league} style={styles.filterBadge}>
                  {getLeagueLogo(league) ? (
                    <Image 
                      source={getLeagueLogo(league)} 
                      style={leagueStyles.badgeLogo} 
                    />
                  ) : (
                    <Text style={styles.filterBadgeText}>{league}</Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.compactIndicator}>
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
        <View style={styles.expandedCardContent}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.leagueChipsScrollContent}
          >
            {availableLeagues.map((league) => (
              <TouchableOpacity
                key={league}
                style={[
                  styles.leagueChip,
                  selectedLeagues.includes(league) && styles.selectedLeagueChip,
                ]}
                onPress={() => handleLeagueChange(league)}
              >
                {getLeagueLogo(league) ? (
                  <View style={leagueStyles.chipContainer}>
                    <Image 
                      source={getLeagueLogo(league)} 
                      style={leagueStyles.chipLogo} 
                    />
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
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );
};

// Additional styles for league logos
const leagueStyles = StyleSheet.create({
  badgeLogo: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    marginRight: 4,
  },
  chipLogo: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    marginRight: 6,
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export default LeagueFilter;