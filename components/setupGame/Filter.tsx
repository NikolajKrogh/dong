import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../app/style/setupGameStyles";

interface MatchFilterProps {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setStartTime: (time: string) => void;
  setEndTime: (time: string) => void;
  resetAllFilters: () => void;
  handleAddAllFilteredMatches: () => void;
  isTimeFilterActive: boolean;
  isDateFilterActive: boolean;
  filteredTeamsData: Array<{ key: string; value: string }>;
  filteredMatches: Array<any>;
}

const MatchFilter: React.FC<MatchFilterProps> = ({
  startDate,
  startTime,
  endTime,
  setStartDate,
  setEndDate,
  setStartTime,
  setEndTime,
  resetAllFilters,
  handleAddAllFilteredMatches,
  isTimeFilterActive,
  isDateFilterActive,
  filteredTeamsData,
  filteredMatches,
}) => {
  const [showTimeFilter, setShowTimeFilter] = useState(false);

  // Keep endDate synchronized with startDate
  useEffect(() => {
    if (startDate) {
      setEndDate(startDate);
    }
  }, [startDate, setEndDate]);

  return (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={styles.filterToggle}
        onPress={() => setShowTimeFilter(!showTimeFilter)}
      >
        <Text style={styles.filterToggleText}>
          {showTimeFilter ? "Hide Filters" : "Filter Matches"}
        </Text>
        <Ionicons
          name={showTimeFilter ? "chevron-up" : "chevron-down"}
          size={16}
          color="#007bff"
        />
      </TouchableOpacity>

      {showTimeFilter && (
        <View style={styles.timeFilterControls}>
          <Text style={styles.filterSectionTitle}>Filter by Date</Text>

          <View style={styles.timeInputGroup}>
            <Text style={styles.timeLabel}>Date:</Text>
            <TextInput
              style={styles.timeInput}
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>

          <Text style={styles.filterSectionTitle}>Filter by Time</Text>

          <View style={styles.timeInputGroup}>
            <Text style={styles.timeLabel}>Start Time:</Text>
            <TextInput
              style={styles.timeInput}
              placeholder="15:45"
              value={startTime}
              onChangeText={setStartTime}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.timeInputGroup}>
            <Text style={styles.timeLabel}>End Time:</Text>
            <TextInput
              style={styles.timeInput}
              placeholder="16:15"
              value={endTime}
              onChangeText={setEndTime}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.filterButtonRow}>
            <TouchableOpacity
              style={styles.resetFilterButton}
              onPress={resetAllFilters}
            >
              <Text style={styles.resetFilterText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addAllButton}
              onPress={handleAddAllFilteredMatches}
            >
              <Text style={styles.addAllButtonText}>Add All Filtered</Text>
            </TouchableOpacity>
          </View>

          {(isTimeFilterActive || isDateFilterActive) && (
            <Text style={styles.filterStatusText}>
              {filteredMatches.length === 0
                ? "No matches found with selected filters"
                : `Found ${filteredMatches.length} fixtures matching filters`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export default MatchFilter;
