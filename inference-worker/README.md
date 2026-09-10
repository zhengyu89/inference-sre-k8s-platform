# inference-worker

FastAPI + ONNX Runtime model-serving worker. See
`../docs/implementation-plan-services.md` (Part A) for the full design.

## Run locally

Dependencies are managed with [uv](https://docs.astral.sh/uv/) — `pyproject.toml` +
`uv.lock`, no more `requirements*.txt`.

```bash
uv sync                # creates .venv and installs runtime + dev deps from uv.lock
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bash
curl -X POST localhost:8000/infer \
  -H 'content-type: application/json' \
  -d '{"requestId":"req-1","input":"multiple failed login attempts detected"}'

curl localhost:8000/health/live
curl localhost:8000/health/ready
curl localhost:8000/metrics
curl localhost:8000/simulation
curl -X PUT localhost:8000/simulation \
  -H 'content-type: application/json' \
  -d '{"additionalLatencyMs":300,"errorRate":0.1,"maxConcurrency":5}'
```

## Rebuilding the model

`models/classifier.onnx` is committed so the image build needs no training
step. To regenerate it:

```bash
uv run models/build_model.py    # uv sync already installs the dev group needed here
```

The task is a trivial binary text classifier (`normal` vs `suspicious`) —
the model is not the point of this project, the operability around it is.
The vectorizer is trained with `lowercase=False` and the worker lowercases
input itself in `app/model.py`; letting skl2onnx compile `lowercase=True`
bakes in an ONNX `StringNormalizer` op that requires an OS locale
(`en_US.UTF-8`) that a slim container image won't have.

## Docker

```bash
docker build -t inference-sre-worker .
docker run -p 8000:8000 inference-sre-worker
```

Or via the repo's `docker-compose.yml` (`inference-worker` service).
