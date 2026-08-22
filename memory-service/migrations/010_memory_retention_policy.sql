ALTER TABLE memory.memories DROP CONSTRAINT IF EXISTS memories_authority_check;
ALTER TABLE memory.memories ADD CONSTRAINT memories_authority_check
  CHECK (authority IN ('HUMAN','POLICY','SOURCE_CODE','CI','SCANNER','TOOL','LLM_INFERENCE'));

DROP INDEX IF EXISTS memory.memories_expiry_idx;
CREATE INDEX memories_expiry_idx ON memory.memories(expires_at)
  WHERE expires_at IS NOT NULL AND status IN ('CANDIDATE','ACTIVE');
