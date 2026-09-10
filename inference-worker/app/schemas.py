"""Pydantic request/response models for the worker's HTTP surface."""

from typing import Literal

from pydantic import BaseModel, Field


class InferRequest(BaseModel):
    requestId: str = Field(min_length=1, max_length=128)
    input: str = Field(min_length=1, max_length=4096)


class InferResponse(BaseModel):
    requestId: str
    modelVersion: str
    prediction: str
    confidence: float
    queueTimeMs: int
    inferenceTimeMs: int
    totalTimeMs: int
    worker: str


class ErrorResponse(BaseModel):
    error: dict


class LiveResponse(BaseModel):
    status: Literal["alive"]


class ReadyResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    modelLoaded: bool


class SimulationConfig(BaseModel):
    additionalLatencyMs: int = Field(ge=0, le=5000)
    errorRate: float = Field(ge=0.0, le=1.0)
    maxConcurrency: int = Field(ge=1, le=100)
