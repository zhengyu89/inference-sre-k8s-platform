import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { InferenceDetail } from "../api/types";

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["request", id],
    queryFn: () => apiClient.get<InferenceDetail>(`/inference/${id}`),
    enabled: id !== undefined,
  });
}
