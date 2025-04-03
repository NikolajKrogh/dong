import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import DatePicker from "react-native-date-picker"; // Import DatePicker
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
  startTime = "15:00", // Default start time
  endTime = "22:00",   // Default end time
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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isStartTimePickerOpen, setIsStartTimePickerOpen] = useState(false);
  const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false);
  
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
      <Text style={styles.expandableCardTitle}>Find Matches</Text>
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
            <TouchableOpacity
              style={[styles.dateInput, isDateFilterActive && styles.activeInput]}
              onPress={() => setIsDatePickerOpen(true)}
            >
              <Text>{startDate || "Select Date"}</Text>
            </TouchableOpacity>
            <DatePicker
              modal
              mode="date"
              open={isDatePickerOpen}
              date={new Date(startDate || Date.now())}
              onConfirm={(date) => {
                setIsDatePickerOpen(false);
                setStartDate(date.toISOString().split("T")[0]); // Apply filter immediately
              }}
              onCancel={() => setIsDatePickerOpen(false)}
            />
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Time Range</Text>
            <View style={styles.timeInputRow}>
              <TouchableOpacity
                style={[styles.timeInput, isTimeFilterActive && styles.activeInput]}
                onPress={() => setIsStartTimePickerOpen(true)}
              >
                <Text>{startTime || "Start Time"}</Text>
              </TouchableOpacity>
              <DatePicker
                modal
                mode="time"
                open={isStartTimePickerOpen}
                date={new Date()}
                onConfirm={(date) => {
                  setIsStartTimePickerOpen(false);
                  setStartTime(date.toTimeString().slice(0, 5)); // Apply filter immediately
                }}
                onCancel={() => setIsStartTimePickerOpen(false)}
              />

              <Text style={styles.timeSeparatorText}>to</Text>

              <TouchableOpacity
                style={[styles.timeInput, isTimeFilterActive && styles.activeInput]}
                onPress={() => setIsEndTimePickerOpen(true)}
              >
                <Text>{endTime || "End Time"}</Text>
              </TouchableOpacity>
              <DatePicker
                modal
                mode="time"
                open={isEndTimePickerOpen}
                date={new Date()}
                onConfirm={(date) => {
                  setIsEndTimePickerOpen(false);
                  setEndTime(date.toTimeString().slice(0, 5)); // Apply filter immediately
                }}
                onCancel={() => setIsEndTimePickerOpen(false)}
              />
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