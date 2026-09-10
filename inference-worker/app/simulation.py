"""Live simulation state: injected latency, injected error rate, and a
resizable concurrency limiter.

The worker is the source of truth for this config (the backend forwards PUT
requests here and only caches the result). See implementation-plan-services.md
§6 (PUT /simulation) and §10 (Redis is a cache, not the source of truth).
"""

import asyncio
import random

from . import config


class ConcurrencyLimiter:
    """A resizable alternative to asyncio.Semaphore.

    A plain Semaphore can't be resized without either leaking permits or
    stranding waiters, so this tracks an explicit active count against a
    mutable ceiling under a Condition instead.
    """

    def __init__(self, max_concurrency: int) -> None:
        self._max = max_concurrency
        self._active = 0
        self._condition = asyncio.Condition()

    async def acquire(self, timeout: float) -> bool:
        """Wait for a free slot. Returns False on timeout (caller should reject)."""
        async with self._condition:
            try:
                await asyncio.wait_for(
                    self._condition.wait_for(lambda: self._active < self._max),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                return False
            self._active += 1
            return True

    async def release(self) -> None:
        async with self._condition:
            self._active = max(0, self._active - 1)
            self._condition.notify_all()

    async def resize(self, new_max: int) -> None:
        async with self._condition:
            self._max = new_max
            self._condition.notify_all()

    @property
    def max_concurrency(self) -> int:
        return self._max

    @property
    def active(self) -> int:
        return self._active


class SimulationState:
    def __init__(self) -> None:
        self.additional_latency_ms = config.DEFAULT_ADDITIONAL_LATENCY_MS
        self.error_rate = config.DEFAULT_ERROR_RATE
        self.limiter = ConcurrencyLimiter(config.DEFAULT_MAX_CONCURRENCY)

    def as_dict(self) -> dict:
        return {
            "additionalLatencyMs": self.additional_latency_ms,
            "errorRate": self.error_rate,
            "maxConcurrency": self.limiter.max_concurrency,
        }

    async def update(self, additional_latency_ms: int, error_rate: float, max_concurrency: int) -> None:
        self.additional_latency_ms = additional_latency_ms
        self.error_rate = error_rate
        await self.limiter.resize(max_concurrency)

    async def apply_latency(self) -> None:
        if self.additional_latency_ms > 0:
            await asyncio.sleep(self.additional_latency_ms / 1000)

    def roll_injected_error(self) -> bool:
        """True if this request should be failed as an injected error."""
        return self.error_rate > 0 and random.random() < self.error_rate


# Single process-wide instance — the worker runs as a single uvicorn worker
# process (see Dockerfile), so no cross-process sharing is needed.
simulation_state = SimulationState()
