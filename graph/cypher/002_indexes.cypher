CREATE FULLTEXT INDEX chunk_fulltext IF NOT EXISTS FOR (c:Chunk) ON EACH [c.text, c.summary];
