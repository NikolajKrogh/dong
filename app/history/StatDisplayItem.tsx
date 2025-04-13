import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './historyStyles';

/**
 * @interface StatDisplayItemProps
 * @brief Interface for the properties of the StatDisplayItem component.
 * 
 * @property {keyof typeof Ionicons.glyphMap} iconName - The name of the Ionicons icon to display.
 * @property {string | number} value - The value to display for the statistic.
 * @property {string} label - The label to display below the value.
 * @property {string} [iconColor='#0275d8'] - The color of the icon (optional, defaults to '#0275d8').
 * @property {object} [style] - Custom styles to apply to the container (optional).
 */
interface StatDisplayItemProps {
  iconName: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  iconColor?: string;
  style?: object; // Allow passing custom styles
}

/**
 * @brief A functional component that displays a statistic with an icon, value, and label.
 * 
 * This component is used to display key statistics in a consistent format, 
 * including an icon, a numerical value, and a descriptive label.
 *
 * @param {StatDisplayItemProps} props - The properties for the component.
 * @returns {React.ReactElement} A View containing the icon, value, and label.
 */
const StatDisplayItem: React.FC<StatDisplayItemProps> = ({
  iconName,
  value,
  label,
  iconColor = '#0275d8',
  style,
}) => {
  return (
    <View style={[styles.summaryItem, style]}> {/* Use a base style */}
      <Ionicons name={iconName} size={20} color={iconColor} style={styles.summaryIcon} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
};

export default StatDisplayItem;