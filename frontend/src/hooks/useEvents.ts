import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { EventListParams, EventListResponse } from "../api/types";

export function useEvents(params: EventListParams = {}) {
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => apiClient.get<EventListResponse>("/events", params),
    placeholderData: (previous) => previous,
  });
}
