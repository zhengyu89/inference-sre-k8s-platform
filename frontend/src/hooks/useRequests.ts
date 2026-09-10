import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { InferenceListParams, InferenceListResponse } from "../api/types";

export function useRequests(params: InferenceListParams = {}) {
  return useQuery({
    queryKey: ["requests", params],
    queryFn: () => apiClient.get<InferenceListResponse>("/inference", params),
    placeholderData: (previous) => previous,
  });
}
