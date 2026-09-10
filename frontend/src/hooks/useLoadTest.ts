import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../api/client";
import type { LoadTestProgress, LoadTestRequestBody, LoadTestStarted } from "../api/types";

const POLL_INTERVAL_MS = 1000;

export function useLoadTest() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: (body: LoadTestRequestBody) =>
      apiClient.post<LoadTestStarted>("/load-tests", body),
    onSuccess: (data) => {
      setActiveId(data.id);
      queryClient.invalidateQueries({ queryKey: ["load-test", data.id] });
    },
  });

  const progress = useQuery({
    queryKey: ["load-test", activeId],
    queryFn: () => apiClient.get<LoadTestProgress>(`/load-tests/${activeId}`),
    enabled: activeId !== null,
    refetchInterval: (query) => (query.state.data?.status === "running" ? POLL_INTERVAL_MS : false),
  });

  function reset() {
    setActiveId(null);
    start.reset();
  }

  return { activeId, start, progress, reset };
}
