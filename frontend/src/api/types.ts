// Hand-written mirror of the backend contract (implementation-plan-backend.md, §5).
// This is the single place to update when that contract changes.

export type ServiceStatus = "healthy" | "degraded" | "down";
export type RequestStatus = "success" | "failed";
export type LoadTestStatus = "running" | "completed" | "aborted" | "failed";
export type EventSeverity = "info" | "warning" | "error";

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// 5.1 Dashboard

export interface DashboardSummary {
  serviceStatus: ServiceStatus;
  modelVersion: string;
  workerReplicas: number;
  requestsPerSecond: number;
  totalRequests: number;
  successRate: number;
  p95LatencyMs: number;
  activeRequests: number;
  queueDepth: number;
}

// 5.2 Inference

export interface InferenceRequestBody {
  input: string;
}

export interface InferenceResult {
  requestId: string;
  model: string;
  prediction: string;
  confidence: number;
  latencyMs: number;
  status: RequestStatus;
}

// 5.3 Request history

export interface InferenceListItem {
  requestId: string;
  model: string;
  prediction: string | null;
  status: RequestStatus;
  latencyMs: number | null;
  createdAt: string;
}

export interface InferenceListResponse {
  items: InferenceListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface InferenceDetail {
  requestId: string;
  model: string;
  input: string;
  prediction: string | null;
  confidence: number | null;
  status: RequestStatus;
  queueTimeMs: number | null;
  computeTimeMs: number | null;
  latencyMs: number | null;
  worker: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface InferenceListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  status?: RequestStatus;
  model?: string;
}

// 5.4 Load tests

export interface LoadTestRequestBody {
  requestsPerSecond: number;
  durationSeconds: number;
  concurrency: number;
}

export interface LoadTestStarted {
  id: string;
  status: LoadTestStatus;
}

export interface LoadTestProgress {
  status: LoadTestStatus;
  sent: number;
  successful: number;
  failed: number;
  currentRps: number;
  averageLatencyMs: number;
}

// 5.5 Simulation

export interface SimulationConfig {
  additionalLatencyMs: number;
  errorRate: number;
  maxConcurrency: number;
}

// 5.6 Events

export interface ServiceEvent {
  id: number;
  eventType: string;
  severity: EventSeverity;
  message: string;
  createdAt: string;
}

export interface EventListResponse {
  items: ServiceEvent[];
}

export interface EventListParams {
  [key: string]: string | number | boolean | undefined;
  limit?: number;
  severity?: EventSeverity;
}
