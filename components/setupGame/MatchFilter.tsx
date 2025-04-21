import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../app/style/setupGameStyles";
import { TeamWithLeague } from "../../utils/matchUtils";

/**
 * @brief Interface for the props of the MatchFilter component.
 */
interface MatchFilterProps {
  selectedDate: string;
  startTime?: string;
  endTime?: string;
  setSelectedDate: (date: string) => void;
  setStartTime: (time: string) => void;
  setEndTime: (time: string) => void;
  handleAddAllFilteredMatches: () => void;
  isTimeFilterActive: boolean;
  isDateFilterActive: boolean;
  filteredMatches: any[];
  filteredTeamsData: TeamWithLeague[];
  isLoading?: boolean;
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
  const [rotateAnim] = useState(new Animated.Value(0));

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

  // Animation for the dropdown icon
  const toggleExpand = () => {
    const newState = !showTimeFilter;
    setShowTimeFilter(newState);

    Animated.timing(rotateAnim, {
      toValue: newState ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const isAnyFilterActive = localDateFilterActive || localTimeFilterActive;
  const formattedDate = selectedDate
    ? new Date(selectedDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Select Date";

  return (
    <View style={styles.filterCard}>
      <TouchableOpacity
        style={styles.filterCardHeader}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.filterCardContent}>
          <View style={styles.filterTitleContainer}>
            <Ionicons name="options-outline" size={22} color="#1976d2" />
            <Text style={styles.filterTitle}>Find Matches</Text>
          </View>

          <View style={styles.filterBadgesSection}>
            {localDateFilterActive || localTimeFilterActive ? (
              <View style={styles.filterBadgesContainer}>
                {localDateFilterActive && (
                  <View style={styles.filterBadge}>
                    <Ionicons name="calendar" size={16} color="#1976d2" />
                    <Text style={styles.filterBadgeText} numberOfLines={1}>
                      {formattedDate}
                    </Text>
                  </View>
                )}
                {localTimeFilterActive && (
                  <View style={styles.filterBadge}>
                    <Ionicons name="time" size={16} color="#1976d2" />
                    <Text style={styles.filterBadgeText} numberOfLines={1}>
                      {startTime.substring(0, 5)} - {endTime.substring(0, 5)}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.noFiltersText}>No active filters</Text>
            )}

            <Animated.View
              style={[styles.indicatorContainer, { transform: [{ rotate }] }]}
            >
              <Ionicons name="chevron-down" size={20} color="#555" />
            </Animated.View>
          </View>
        </View>
      </TouchableOpacity>

      {showTimeFilter && (
        <View style={styles.expandedContent}>
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Date Filter</Text>
            <TouchableOpacity
              style={[
                styles.filterInput,
                localDateFilterActive && styles.activeInput,
              ]}
              onPress={() => setIsDatePickerOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={localDateFilterActive ? "#1976d2" : "#666"}
                style={styles.inputIcon}
              />
              <Text
                style={[
                  styles.inputText,
                  localDateFilterActive && styles.activeInputText,
                ]}
              >
                {formattedDate}
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
            <Text style={styles.sectionTitle}>Time Range</Text>
            <View style={styles.timeInputRow}>
              <TouchableOpacity
                style={[
                  styles.timeInput,
                  localTimeFilterActive && styles.activeInput,
                ]}
                onPress={() => setIsStartTimePickerOpen(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={localTimeFilterActive ? "#1976d2" : "#666"}
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.inputText,
                    localTimeFilterActive && styles.activeInputText,
                  ]}
                >
                  {startTime || "Start"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.timeSeparator}>to</Text>

              <TouchableOpacity
                style={[
                  styles.timeInput,
                  localTimeFilterActive && styles.activeInput,
                ]}
                onPress={() => setIsEndTimePickerOpen(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={localTimeFilterActive ? "#1976d2" : "#666"}
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.inputText,
                    localTimeFilterActive && styles.activeInputText,
                  ]}
                >
                  {endTime || "End"}
                </Text>
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

          <View style={styles.resultsSummary}>
            <View style={styles.matchCountContainer}>
              <Ionicons name="football-outline" size={16} color="#1976d2" />
              <Text style={styles.matchCount}>
                {filteredMatches.length} matches found
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.filterActionButton,
                !isAnyFilterActive && styles.disabledButton,
              ]}
              onPress={handleAddAllFilteredMatches}
              disabled={!isAnyFilterActive}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={16} color="#fff" />
              <Text style={styles.filterActionButtonText}>Add Matches</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default MatchFilter;
