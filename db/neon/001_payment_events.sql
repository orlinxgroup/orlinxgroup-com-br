BEGIN;
CREATE SCHEMA IF NOT EXISTS orlinx_payments;
REVOKE ALL ON SCHEMA orlinx_payments FROM PUBLIC;
CREATE TABLE IF NOT EXISTS orlinx_payments.events (
  event_id uuid PRIMARY KEY,
  order_reference varchar(100) NOT NULL,
  provider varchar(20) NOT NULL CHECK (provider IN ('google_pay', 'woovi')),
  environment varchar(10) NOT NULL CHECK (environment IN ('TEST', 'PRODUCTION')),
  event_type varchar(30) NOT NULL CHECK (event_type IN ('test_completed', 'charge_created', 'payment_confirmed', 'payment_failed', 'payment_refunded')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 99999999),
  currency char(3) NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_type <> 'test_completed' OR environment = 'TEST')
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON orlinx_payments.events(order_reference, created_at);
CREATE OR REPLACE FUNCTION orlinx_payments.reject_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Payment events are append-only';
END;
$$;
DROP TRIGGER IF EXISTS events_append_only ON orlinx_payments.events;
CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
ON orlinx_payments.events FOR EACH STATEMENT
EXECUTE FUNCTION orlinx_payments.reject_event_mutation();
REVOKE ALL ON ALL TABLES IN SCHEMA orlinx_payments FROM PUBLIC;
COMMIT;
