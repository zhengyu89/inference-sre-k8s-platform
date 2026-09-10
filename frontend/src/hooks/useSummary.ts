import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { DashboardSummary } from "../api/types";

const POLL_INTERVAL_MS = 5000;

export function useSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiClient.get<DashboardSummary>("/dashboard/summary"),
    refetchInterval: POLL_INTERVAL_MS,
    // Keep the last good summary visible while a poll is in flight or failing —
    // pages mark it stale rather than blanking it out.
    placeholderData: (previous) => previous,
  });
}
