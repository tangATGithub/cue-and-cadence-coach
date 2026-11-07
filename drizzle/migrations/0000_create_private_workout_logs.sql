CREATE TABLE public.workout_logs (
 id uuid PRIMARY KEY,
 device_hash text NOT NULL,
 started_at timestamptz NOT NULL,
 completed_at timestamptz NOT NULL,
 duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
 coach_voice text NOT NULL CHECK (coach_voice IN ('male', 'female')),
 exercises text[] NOT NULL DEFAULT '{}',
 reported_details text NOT NULL DEFAULT ''
);
GRANT ALL ON public.workout_logs TO service_role;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX workout_logs_device_completed_idx ON public.workout_logs(device_hash, completed_at DESC);
COMMENT ON TABLE public.workout_logs IS 'Private device-capability workout journal; no direct browser access. Server verifies the high-entropy device capability and scopes every operation by its SHA-256 hash.';