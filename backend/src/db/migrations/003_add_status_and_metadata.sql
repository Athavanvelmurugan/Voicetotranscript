-- Migration 003: Add draft_only_unverified status & flag, and transcript segment metadata
-- Reversible and idempotent

DO $$
BEGIN
  -- 1. Update consultations_status_check to include 'draft_only_unverified'
  ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
  ALTER TABLE consultations ADD CONSTRAINT consultations_status_check
    CHECK (status IN (
      'scheduled', 'recording', 'paused', 'processing', 'completed', 'cancelled', 'transcription_failed', 'draft_only_unverified'
    ));

  -- 2. Add draft_only_unverified boolean flag to consultations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'consultations' AND column_name = 'draft_only_unverified'
  ) THEN
    ALTER TABLE consultations ADD COLUMN draft_only_unverified BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- 3. Add metadata columns to transcript_segments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'model'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN model VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'provider'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN provider VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'prompt_version'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN prompt_version VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'params'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN params JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'avg_logprob'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN avg_logprob NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'no_speech_prob'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN no_speech_prob NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'needs_vet_review'
  ) THEN
    ALTER TABLE transcript_segments ADD COLUMN needs_vet_review BOOLEAN NOT NULL DEFAULT false;
  END IF;

END $$;

