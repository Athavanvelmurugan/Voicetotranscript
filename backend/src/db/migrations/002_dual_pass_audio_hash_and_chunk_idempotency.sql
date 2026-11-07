-- Migration 002: Dual-Pass, Audio Hash Verification, and Chunk Idempotency
-- Reversible and idempotent

DO $$
BEGIN
  -- 1. Dual-Pass columns on transcript_segments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'pass_number'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN pass_number INTEGER NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'is_final_pass'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN is_final_pass BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'replaced_by_pass'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN replaced_by_pass INTEGER DEFAULT NULL;
  END IF;

  -- 2. Update unique constraint on transcript_segments to include pass_number
  ALTER TABLE transcript_segments DROP CONSTRAINT IF EXISTS uq_consultation_sequence_partial;
  ALTER TABLE transcript_segments DROP CONSTRAINT IF EXISTS uq_consultation_pass_sequence_partial;
  ALTER TABLE transcript_segments ADD CONSTRAINT uq_consultation_pass_sequence_partial 
    UNIQUE (consultation_id, pass_number, sequence_number, is_partial);

  -- 3. Audio Hash column on consultation_audio
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'consultation_audio' AND column_name = 'audio_hash'
  ) THEN
    ALTER TABLE consultation_audio ADD COLUMN audio_hash VARCHAR(64);
  END IF;

  -- Backfill audio_hash for any existing records
  UPDATE consultation_audio 
  SET audio_hash = encode(sha256(audio_data), 'hex') 
  WHERE audio_hash IS NULL;

  -- 4. Chunk receipts table for idempotency
  CREATE TABLE IF NOT EXISTS consultation_chunk_receipts (
    id SERIAL PRIMARY KEY,
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_consultation_chunk UNIQUE (consultation_id, chunk_index)
  );

  CREATE INDEX IF NOT EXISTS idx_chunk_receipts ON consultation_chunk_receipts(consultation_id, chunk_index);

END $$;

