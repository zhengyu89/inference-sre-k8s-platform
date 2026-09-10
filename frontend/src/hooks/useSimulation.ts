import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { SimulationConfig } from "../api/types";

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  additionalLatencyMs: 0,
  errorRate: 0,
  maxConcurrency: 10,
};

export function isDefaultSimulation(config: SimulationConfig | undefined): boolean {
  if (!config) return true;
  return (
    config.additionalLatencyMs === DEFAULT_SIMULATION_CONFIG.additionalLatencyMs &&
    config.errorRate === DEFAULT_SIMULATION_CONFIG.errorRate &&
    config.maxConcurrency === DEFAULT_SIMULATION_CONFIG.maxConcurrency
  );
}

export function useSimulation() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["simulation"],
    queryFn: () => apiClient.get<SimulationConfig>("/simulation"),
    placeholderData: (previous) => previous,
  });

  const update = useMutation({
    mutationFn: (config: SimulationConfig) => apiClient.put<SimulationConfig>("/simulation", config),
    onSuccess: (data) => {
      queryClient.setQueryData(["simulation"], data);
    },
  });

  return { ...query, update };
}
