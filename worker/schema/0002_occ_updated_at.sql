-- OCC compares updated_at at millisecond precision. Advance at least 1ms so
-- a winner invalidates other writers that shared the same base timestamp.
-- Apply in numeric order after 0001. Never re-run 0001 after this file:
-- 0001's CREATE OR REPLACE would reset set_updated_at to NOW().
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  IF OLD.updated_at IS NOT NULL
     AND date_trunc('milliseconds', NEW.updated_at)
       = date_trunc('milliseconds', OLD.updated_at) THEN
    NEW.updated_at = OLD.updated_at + INTERVAL '1 millisecond';
  END IF;
  RETURN NEW;
END;
$$;
