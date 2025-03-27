import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import styles from "../../app/style/setupGameStyles";

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

  return (
    <>
      <TouchableOpacity
        style={styles.expandableCard}
        onPress={() => setIsLeagueExpanded(!isLeagueExpanded)}
      >
        <View style={styles.expandableCardContent}>
          <View style={styles.expandableCardLeft}>
            <Ionicons name="funnel-outline" size={20} color="#0275d8" />
            <Text style={styles.expandableCardTitle}>League Filter</Text>
          </View>

          <View style={styles.rightContent}>
            <View style={styles.filterBadgesContainer}>
              {selectedLeagues.map((league) => (
                <View key={league} style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{league}</Text>
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
                <Text
                  style={[
                    styles.leagueChipText,
                    selectedLeagues.includes(league) &&
                      styles.selectedLeagueChipText,
                  ]}
                >
                  {league}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );
};

export default LeagueFilter;