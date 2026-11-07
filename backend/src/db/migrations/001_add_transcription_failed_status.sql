-- Migration 001: Add 'transcription_failed' status to consultations
DO $$
BEGIN
  ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
  ALTER TABLE consultations ADD CONSTRAINT consultations_status_check 
    CHECK (status IN ('scheduled', 'recording', 'paused', 'processing', 'completed', 'cancelled', 'transcription_failed'));
END $$;
