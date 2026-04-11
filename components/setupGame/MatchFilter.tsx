import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import AppIcon from "../AppIcon";
import { MatchData } from "../../utils/matchUtils";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
import {
  formatDateIsoValue,
  parseDateIsoValue,
  parseTimeIsoValue,
  PlatformDatePicker,
  PlatformTimePicker,
} from "../../platform";

/**
 * Props for match filter component.
 * @description Provides date/time filter state + setters, bulk add handler and contextual match/team datasets (plus league selection context for integration with other filters).
 * @property selectedDate Currently selected date (YYYY-MM-DD) used for filtering.
 * @property startTime Optional start time (HH:MM 24h) boundary for time range filtering.
 * @property endTime Optional end time (HH:MM 24h) boundary for time range filtering.
 * @property setSelectedDate Setter to update the selected date ISO string.
 * @property setStartTime Setter to update the start time string.
 * @property setEndTime Setter to update the end time string.
 * @property handleAddAllFilteredMatches Invoked to add every match in `filteredMatches` (bulk add action).
 * @property isTimeFilterActive Whether a time range filter is currently applied.
 * @property isDateFilterActive Whether a date filter is currently applied.
 * @property filteredMatches Array of matches that satisfy current date/time (and possibly external) filters.
 * @property filteredTeamsData Teams derived from filtered matches (supports dependent dropdowns; may be unused here but passed through for composition).
 * @property isLoading Optional loading flag to show pending state while source data loads.
 * @property availableLeagues All leagues available (for external league filtering UI integration).
 * @property selectedLeagues Leagues currently selected elsewhere in the setup flow.
 * @property handleLeagueChange Callback to toggle a league (forwarded for integrated controls if rendered inside this component).
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
  filteredMatches: MatchData[];
  isLoading?: boolean;
}

/**
 * Match filter.
 * @description Date + optional time range filtering UI with collapse animation and bulk add action.
 * @param {MatchFilterProps} props Component props.
 * @returns {JSX.Element} Filter element.
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
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isStartTimePickerOpen, setIsStartTimePickerOpen] = useState(false);
  const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false);
  const rotateProgress = useSharedValue(0);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateProgress.value * 180}deg` }],
  }));

  const toggleExpand = () => {
    const newState = !showTimeFilter;
    setShowTimeFilter(newState);
    rotateProgress.value = withTiming(newState ? 1 : 0, { duration: 250 });
  };

  const localDateFilterActive = isDateFilterActive || selectedDate.length > 0;
  const localTimeFilterActive =
    isTimeFilterActive || (startTime.length > 0 && endTime.length > 0);
  const isAnyFilterActive = localDateFilterActive || localTimeFilterActive;
  const selectedDateValue = parseDateIsoValue(selectedDate, new Date());
  const formattedDate = selectedDate
    ? selectedDateValue.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Select Date";
  const startTimeValue = parseTimeIsoValue(startTime, new Date());
  const endTimeValue = parseTimeIsoValue(endTime, new Date());

  return (
    <View style={styles.filterCard}>
      <TouchableOpacity
        style={styles.filterCardHeader}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.filterCardContent}>
          <View style={styles.filterTitleContainer}>
            <AppIcon
              name="options-outline"
              size={22}
              color={colors.primaryFocus}
            />
            <Text style={styles.filterTitle}>Match Schedule</Text>
          </View>

          <View style={styles.filterBadgesSection}>
            {localDateFilterActive || localTimeFilterActive ? (
              <View style={styles.filterBadgesContainer}>
                {localDateFilterActive && (
                  <View style={styles.filterBadge}>
                    <AppIcon
                      name="calendar"
                      size={16}
                      color={colors.primaryFocus}
                    />
                    <Text style={styles.filterBadgeText} numberOfLines={1}>
                      {formattedDate}
                    </Text>
                  </View>
                )}
                {localTimeFilterActive && (
                  <View style={styles.filterBadge}>
                    <AppIcon
                      name="time"
                      size={16}
                      color={colors.primaryFocus}
                    />
                    <Text style={styles.filterBadgeText} numberOfLines={1}>
                      {startTime.substring(0, 5)} - {endTime.substring(0, 5)}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.noFiltersText}>No active filters</Text>
            )}

            <Animated.View style={[styles.indicatorContainer, indicatorStyle]}>
              <AppIcon
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
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
              <AppIcon
                name="calendar-outline"
                size={18}
                color={
                  localDateFilterActive ? colors.primaryFocus : colors.textMuted
                }
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
            <PlatformDatePicker
              open={isDatePickerOpen}
              date={selectedDateValue}
              onConfirm={(date) => {
                setIsDatePickerOpen(false);
                setSelectedDate(formatDateIsoValue(date));
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
                <AppIcon
                  name="time-outline"
                  size={18}
                  color={
                    localTimeFilterActive
                      ? colors.primaryFocus
                      : colors.textMuted
                  }
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
                <AppIcon
                  name="time-outline"
                  size={18}
                  color={
                    localTimeFilterActive
                      ? colors.primaryFocus
                      : colors.textMuted
                  }
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

              <PlatformTimePicker
                open={isStartTimePickerOpen}
                date={startTimeValue}
                onConfirm={(date) => {
                  setIsStartTimePickerOpen(false);
                  setStartTime(date.toTimeString().slice(0, 5));
                }}
                onCancel={() => setIsStartTimePickerOpen(false)}
              />

              <PlatformTimePicker
                open={isEndTimePickerOpen}
                date={endTimeValue}
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
              <AppIcon
                name="football-outline"
                size={16}
                color={colors.primaryFocus}
              />
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
              <AppIcon name="add-circle" size={16} color={colors.white} />
              <Text style={styles.filterActionButtonText}>Add Matches</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default MatchFilter;
