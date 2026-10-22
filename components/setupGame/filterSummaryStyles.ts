import { StyleSheet } from "react-native";

export const filterSummaryStyles = StyleSheet.create({
  button: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 48 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { flex: 1, fontSize: 14, fontWeight: "600" },
  values: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  value: { fontSize: 14, fontWeight: "600" },
});
