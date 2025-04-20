import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../app/style/setupGameStyles";

/**
 * @brief Interface for the props of the MatchFilter component.
 */
interface MatchFilterProps {
  selectedDate: string; 
  startTime: string;
  endTime: string;
  setSelectedDate: (date: string) => void;
  setStartTime: (time: string) => void;
  setEndTime: (time: string) => void;
  resetAllFilters: () => void;
  handleAddAllFilteredMatches: () => void;
  isTimeFilterActive: boolean;
  isDateFilterActive: boolean;
  filteredTeamsData: Array<{ key: string; value: string }>;
  filteredMatches: Array<any>;
  isLoading: boolean;
}

/**
 * @brief Functional component that renders a filter for matches.
 *
 * This component allows users to filter matches by date and time.
 * It provides options to select a date, a time range, and actions to reset or apply the filters.
 *
 * @param selectedDate The selected date for the filter.
 * @param startTime The start time for the filter.
 * @param endTime The end time for the filter.
 * @param setSelectedDate Function to set the selected date.
 * @param setStartTime Function to set the start time.
 * @param setEndTime Function to set the end time.
 * @param resetAllFilters Function to reset all filters.
 * @param handleAddAllFilteredMatches Function to handle adding all filtered matches.
 * @param isTimeFilterActive Boolean indicating if the time filter is active.
 * @param isDateFilterActive Boolean indicating if the date filter is active.
 * @param filteredTeamsData Array of filtered team data.
 * @param filteredMatches Array of filtered matches.
 * @param isLoading Boolean indicating if the data is loading.
 *
 * @return A React element, representing the match filter.
 */
const MatchFilter: React.FC<MatchFilterProps> = ({
  selectedDate,
  startTime = "15:00",
  endTime = "22:00",
  setSelectedDate,
  setStartTime,
  setEndTime,
  resetAllFilters,
  handleAddAllFilteredMatches,
  isTimeFilterActive,
  isDateFilterActive,
  filteredMatches,
  isLoading = false,
}) => {
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isStartTimePickerOpen, setIsStartTimePickerOpen] = useState(false);
  const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false);

  const [localDateFilterActive, setLocalDateFilterActive] =
    useState(isDateFilterActive);
  const [localTimeFilterActive, setLocalTimeFilterActive] =
    useState(isTimeFilterActive);

  useEffect(() => {
    setLocalDateFilterActive(isDateFilterActive);
  }, [isDateFilterActive]);

  useEffect(() => {
    setLocalTimeFilterActive(isTimeFilterActive);
  }, [isTimeFilterActive]);

  useEffect(() => {
    setLocalDateFilterActive(selectedDate.length > 0);
  }, [selectedDate]);

  useEffect(() => {
    const hasValidTime = startTime.length > 0 && endTime.length > 0;
    setLocalTimeFilterActive(hasValidTime);
  }, [startTime, endTime]);

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
                    {selectedDate.substring(5) || "Date"}
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
              style={[
                styles.dateInput,
                localDateFilterActive && styles.activeInput,
              ]}
              onPress={() => setIsDatePickerOpen(true)}
            >
              <Text>
                {selectedDate || "Select Date"}
                {isLoading && " (Loading...)"}
              </Text>
            </TouchableOpacity>
            <DatePicker
              modal
              mode="date"
              open={isDatePickerOpen}
              date={new Date(selectedDate || Date.now())}
              onConfirm={(date) => {
                setIsDatePickerOpen(false);
                setSelectedDate(date.toISOString().split("T")[0]);
              }}
              onCancel={() => setIsDatePickerOpen(false)}
            />
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Time Range</Text>
            <View style={styles.timeInputRow}>
              <TouchableOpacity
                style={[
                  styles.timeInput,
                  localTimeFilterActive && styles.activeInput,
                ]}
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
                  setStartTime(date.toTimeString().slice(0, 5));
                }}
                onCancel={() => setIsStartTimePickerOpen(false)}
              />

              <Text style={styles.timeSeparatorText}>to</Text>

              <TouchableOpacity
                style={[
                  styles.timeInput,
                  localTimeFilterActive && styles.activeInput,
                ]}
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
                  setEndTime(date.toTimeString().slice(0, 5));
                }}
                onCancel={() => setIsEndTimePickerOpen(false)}
              />
            </View>
          </View>

          <View style={styles.filterSummary}>
            <Text style={styles.matchCountText}>
              {filteredMatches.length} matches found
            </Text>
          </View>

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