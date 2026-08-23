ALTER TABLE memory.memories
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_state TEXT,
  ADD COLUMN IF NOT EXISTS sensitivity TEXT,
  ADD COLUMN IF NOT EXISTS retention_class TEXT;

ALTER TABLE memory.memories DROP CONSTRAINT IF EXISTS memories_verification_state_check;
ALTER TABLE memory.memories ADD CONSTRAINT memories_verification_state_check
  CHECK (verification_state IS NULL OR verification_state IN ('UNVERIFIED','VERIFIED','REVIEW_REQUIRED','REJECTED'));
CREATE INDEX IF NOT EXISTS memories_validity_idx ON memory.memories(valid_from, valid_until)
  WHERE status IN ('CANDIDATE','ACTIVE');
