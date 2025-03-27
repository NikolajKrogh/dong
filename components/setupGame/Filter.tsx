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
  endDate,
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
  
  // Local state to track filter activity
  const [localDateFilterActive, setLocalDateFilterActive] = useState(isDateFilterActive);
  const [localTimeFilterActive, setLocalTimeFilterActive] = useState(isTimeFilterActive);

  // Update local state when props change
  useEffect(() => {
    setLocalDateFilterActive(isDateFilterActive);
  }, [isDateFilterActive]);

  useEffect(() => {
    setLocalTimeFilterActive(isTimeFilterActive);
  }, [isTimeFilterActive]);

  // Keep endDate synchronized with startDate
  useEffect(() => {
    if (startDate) {
      setEndDate(startDate);
      setLocalDateFilterActive(startDate.length > 0);
    }
  }, [startDate, setEndDate]);

  // Check if time filter is valid
  useEffect(() => {
    const hasValidTime = startTime.length > 0 && endTime.length > 0;
    setLocalTimeFilterActive(hasValidTime);
  }, [startTime, endTime]);

  const formatDateInput = (input: string) => {
    // Remove any non-digit characters
    const digitsOnly = input.replace(/\D/g, '');
    
    // Format as YYYY-MM-DD
    if (digitsOnly.length <= 4) {
      return digitsOnly;
    } else if (digitsOnly.length <= 6) {
      return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`;
    } else {
      return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6, 8)}`;
    }
  };

  const formatTimeInput = (input: string) => {
    // Remove any non-digit characters
    const digitsOnly = input.replace(/\D/g, '');
    
    // Format as HH:MM
    if (digitsOnly.length <= 2) {
      return digitsOnly;
    } else {
      return `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2, 4)}`;
    }
  };

  // Check if at least one filter is active
  const isAnyFilterActive = localDateFilterActive || localTimeFilterActive;

  return (
    <View style={styles.filterContainer}>
<TouchableOpacity
  style={styles.expandableCard}
  onPress={() => setShowTimeFilter(!showTimeFilter)}
>
  <View style={styles.expandableCardContent}>
    <View style={styles.expandableCardLeft}>
      <Ionicons name="options-outline" size={20} color="#0275d8" />
      <Text style={styles.expandableCardTitle}>Match Filters</Text>
    </View>

    <View style={styles.rightContent}>
      <View style={styles.filterBadgesContainer}>
        {localDateFilterActive && (
          <View style={styles.filterBadge}>
            <Ionicons name="calendar" size={14} color="#0275d8" />
            <Text style={styles.filterBadgeText}>
              {startDate.substring(5) || "Date"}
            </Text>
          </View>
        )}
        {localTimeFilterActive && (
          <View style={styles.filterBadge}>
            <Ionicons name="time" size={14} color="#0275d8" />
            <Text style={styles.filterBadgeText}>
              {startTime} - {endTime}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.compactIndicator}>
        <Ionicons
          name={showTimeFilter ? "chevron-up" : "chevron-down"}
          size={18}
          color="#777"
        />
      </View>
    </View>
  </View>
</TouchableOpacity>

      {showTimeFilter && (
        <View style={styles.expandedCardContent}>
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Date Filter</Text>
            <View style={styles.inputGroup}>
              <View style={styles.labeledInput}>
                <Text style={styles.inputLabel}>Date:</Text>
                <TextInput
                  style={[
                    styles.dateInput,
                    localDateFilterActive && styles.activeInput
                  ]}
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={(text) => setStartDate(formatDateInput(text))}
                />
              </View>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Time Range</Text>
            <View style={styles.timeInputRow}>
              <View style={styles.labeledInput}>
                <Text style={styles.inputLabel}>Start:</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    localTimeFilterActive && styles.activeInput
                  ]}
                  placeholder="15:45"
                  value={startTime}
                  onChangeText={(text) => setStartTime(formatTimeInput(text))}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>

              <View style={styles.timeSeparator}>
                <Text style={styles.timeSeparatorText}>to</Text>
              </View>

              <View style={styles.labeledInput}>
                <Text style={styles.inputLabel}>End:</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    localTimeFilterActive && styles.activeInput
                  ]}
                  placeholder="16:15"
                  value={endTime}
                  onChangeText={(text) => setEndTime(formatTimeInput(text))}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>
          </View>

          {isAnyFilterActive && (
            <View style={styles.filterSummary}>
              <Text style={styles.matchCountText}>
                {filteredMatches.length} matches found
              </Text>
            </View>
          )}

          <View style={styles.filterButtonRow}>
            <TouchableOpacity
              style={styles.resetFilterButton}
              onPress={resetAllFilters}
            >
              <Ionicons name="refresh" size={16} color="#666" />
              <Text style={styles.resetFilterText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.applyFilterButton,
                !isAnyFilterActive && styles.disabledButton,
              ]}
              onPress={handleAddAllFilteredMatches}
              disabled={!isAnyFilterActive}
            >
              <Ionicons name="add-circle" size={16} color="#fff" />
              <Text style={styles.applyFilterText}>Add All Filtered</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default MatchFilter;