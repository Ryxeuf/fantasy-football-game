import { StyleSheet } from "react-native";

export const matchmakingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
  },
  center: {
    padding: 32,
    alignItems: "center",
  },
  searchBox: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
    borderWidth: 2,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
  },
  searchingTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#15803D",
  },
  elapsed: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    color: "#15803D",
  },
  rangeText: {
    fontSize: 12,
    color: "#166534",
  },
  cancelButton: {
    borderColor: "#FCA5A5",
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    gap: 10,
    borderColor: "#E5E7EB",
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  formBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    gap: 12,
    borderColor: "#E5E7EB",
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  teamList: {
    gap: 8,
  },
  teamCard: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  teamCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  teamCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teamName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  teamValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D97706",
  },
  teamRoster: {
    fontSize: 12,
    color: "#6B7280",
  },
  primaryButton: {
    backgroundColor: "#16A34A",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
