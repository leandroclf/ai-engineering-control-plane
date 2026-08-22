ALTER TABLE memory.index_symbols DROP CONSTRAINT IF EXISTS index_symbols_pkey;
ALTER TABLE memory.index_symbols
  ADD CONSTRAINT index_symbols_pkey PRIMARY KEY (repository_id, path, qualified_name, line_start);
