import { randomUUID } from "node:crypto";
import { decrActiveRequests, incrActiveRequests } from "../redis.js";
import {
  getInferenceRequestById,
  insertInferenceRequest,
  listInferenceRequests,
  type InferenceRequestRow,
  type ListInferenceRequestsParams,
  type ListInferenceRequestsResult,
} from "../repositories/inferenceRepo.js";
import { recordEvent } from "./eventService.js";
import { describeWorkerError, inferViaWorker, WorkerError } from "./workerClient.js";

function generateRequestId(): string {
  return `req-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export interface InferenceResult {
  requestId: string;
  model: string;
  prediction: string;
  confidence: number;
  latencyMs: number;
  status: "success";
}

/** A failure the route layer maps straight to an HTTP response — the request
 * has already been persisted as `failed` by the time this is thrown. */
export class InferenceFailure extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(httpStatus: number, code: string, message: string) {
    super(message);
    this.name = "InferenceFailure";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export async function runInference(input: string): Promise<InferenceResult> {
  const requestId = generateRequestId();
  const startedAt = Date.now();

  await incrActiveRequests();
  try {
    let workerResponse;
    try {
      workerResponse = await inferViaWorker({ requestId, input });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const description =
        err instanceof WorkerError
          ? describeWorkerError(err)
          : { httpStatus: 502, code: "WORKER_ERROR", message: (err as Error).message ?? "Unknown worker error" };

      await persistFailure({ requestId, input, latencyMs, errorMessage: description.message });
      throw new InferenceFailure(description.httpStatus, description.code, description.message);
    }

    const latencyMs = Date.now() - startedAt;

    try {
      await insertInferenceRequest({
        id: requestId,
        modelVersion: workerResponse.modelVersion,
        input,
        prediction: workerResponse.prediction,
        confidence: workerResponse.confidence,
        status: "success",
        queueTimeMs: workerResponse.queueTimeMs,
        computeTimeMs: workerResponse.inferenceTimeMs,
        latencyMs,
        worker: workerResponse.worker,
      });
    } catch (err) {
      // Persistence must never swallow the result (backend plan §5.2): log,
      // emit an event, and still return the prediction to the caller.
      console.error(`Failed to persist inference request ${requestId}`, err);
      await recordEvent({
        eventType: "PERSISTENCE_FAILURE",
        severity: "error",
        message: `Failed to persist inference request ${requestId}`,
        metadata: { requestId, error: (err as Error).message },
      });
    }

    return {
      requestId,
      model: workerResponse.modelVersion,
      prediction: workerResponse.prediction,
      confidence: workerResponse.confidence,
      latencyMs,
      status: "success",
    };
  } finally {
    await decrActiveRequests();
  }
}

async function persistFailure(data: {
  requestId: string;
  input: string;
  latencyMs: number;
  errorMessage: string;
}): Promise<void> {
  try {
    await insertInferenceRequest({
      id: data.requestId,
      modelVersion: "unknown",
      input: data.input,
      status: "failed",
      latencyMs: data.latencyMs,
      errorMessage: data.errorMessage,
    });
  } catch (err) {
    console.error(`Failed to persist failed inference request ${data.requestId}`, err);
  }
}

export async function getInferenceHistory(
  params: ListInferenceRequestsParams,
): Promise<ListInferenceRequestsResult> {
  return listInferenceRequests(params);
}

export async function getInferenceById(id: string): Promise<InferenceRequestRow | null> {
  return getInferenceRequestById(id);
}
