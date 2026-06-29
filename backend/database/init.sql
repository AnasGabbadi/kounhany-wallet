CREATE TABLE IF NOT EXISTS billing_schedules (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  period VARCHAR(7) NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'ERROR')),
  result_summary JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_status ON billing_schedules(status);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_scheduled_at ON billing_schedules(scheduled_at);
