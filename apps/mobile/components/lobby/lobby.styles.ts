/**
 * S27.3.4 — Styles partages pour le lobby et ses sous-composants.
 *
 * Extrait de `apps/mobile/app/lobby.tsx`. Aucun changement visuel :
 * meme palette, memes spacings, memes radius. Seul le partage est
 * factorise pour eviter la duplication entre `MatchCard`, `MatchList`,
 * `FilterBar`, `LobbyHeader`, `LobbyActions`, `JoinMatchModal`.
 */

import { StyleSheet } from "react-native";

export const lobbyStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamsButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
  },
  teamsButtonText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "600",
  },
  leaderboardButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
  },
  leaderboardButtonText: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "600",
  },
  settingsButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
  },
  settingsButtonText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "500",
  },
  turnBanner: {
    backgroundColor: "#166534",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  turnBannerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  createButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  matchmakingButton: {
    flex: 1,
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  joinButton: {
    flex: 1,
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cupsButton: {
    flex: 1,
    backgroundColor: "#B45309",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  leaguesButton: {
    flex: 1,
    backgroundColor: "#0E7490",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  starsButton: {
    flex: 1,
    backgroundColor: "#D97706",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  filterButtonActive: {
    backgroundColor: "#2563EB",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },
  filterTextActive: {
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardMyTurn: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: "#6B7280",
  },
  myTurnBadge: {
    backgroundColor: "#22C55E",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  myTurnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  teamName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  score: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#D97706",
    marginHorizontal: 10,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  replayButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#0F172A",
    borderRadius: 6,
    alignItems: "center",
  },
  replayButtonText: {
    color: "#93C5FD",
    fontSize: 13,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#E5E7EB",
  },
  modalCancelText: {
    color: "#374151",
    fontWeight: "600",
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "600",
  },
});
