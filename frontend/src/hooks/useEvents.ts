import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { EventListParams, ServiceEvent } from "../api/types";

export function useEvents(params: EventListParams = {}) {
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => apiClient.get<ServiceEvent[]>("/events", params),
    placeholderData: (previous) => previous,
  });
}
