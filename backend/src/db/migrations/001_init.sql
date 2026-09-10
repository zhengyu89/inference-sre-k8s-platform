-- Initial schema. See docs/implementation-plan-backend.md §6 and
-- docs/implementation-plan-services.md §9. PostgreSQL is the source of
-- truth for everything here; Redis only ever caches a view of it.

CREATE TABLE IF NOT EXISTS inference_requests (
  id              text PRIMARY KEY,           -- e.g. req-1043
  model_version   text NOT NULL,
  input           text NOT NULL,
  prediction      text,
  confidence      real,
  status          text NOT NULL,              -- success | failed
  queue_time_ms   integer,
  compute_time_ms integer,
  latency_ms      integer,
  worker          text,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inference_requests_status_check CHECK (status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS inference_requests_created_at_idx
  ON inference_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS inference_requests_status_created_at_idx
  ON inference_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS inference_requests_model_created_at_idx
  ON inference_requests (model_version, created_at DESC);

CREATE TABLE IF NOT EXISTS service_events (
  id         bigserial PRIMARY KEY,
  event_type text NOT NULL,
  severity   text NOT NULL,                   -- info | warning | error
  message    text NOT NULL,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_events_severity_check CHECK (severity IN ('info', 'warning', 'error'))
);

CREATE INDEX IF NOT EXISTS service_events_created_at_idx
  ON service_events (created_at DESC);

CREATE TABLE IF NOT EXISTS load_tests (
  id                    text PRIMARY KEY,     -- e.g. loadtest-103
  requests_per_second   integer NOT NULL,
  duration_seconds      integer NOT NULL,
  concurrency           integer NOT NULL,
  status                text NOT NULL,        -- running | completed | aborted | failed
  requests_sent         integer NOT NULL DEFAULT 0,
  requests_successful   integer NOT NULL DEFAULT 0,
  requests_failed       integer NOT NULL DEFAULT 0,
  average_latency_ms    integer,
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  CONSTRAINT load_tests_status_check CHECK (status IN ('running', 'completed', 'aborted', 'failed'))
);

CREATE INDEX IF NOT EXISTS load_tests_started_at_idx
  ON load_tests (started_at DESC);

CREATE TABLE IF NOT EXISTS model_versions (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  version    text NOT NULL,
  status     text NOT NULL DEFAULT 'active',  -- active | inactive
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

INSERT INTO model_versions (name, version, status)
VALUES ('classifier', 'v1', 'active')
ON CONFLICT (name, version) DO NOTHING;
