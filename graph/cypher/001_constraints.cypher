CREATE CONSTRAINT repository_id IF NOT EXISTS FOR (n:Repository) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT file_identity IF NOT EXISTS FOR (n:File) REQUIRE (n.repository_id, n.path) IS UNIQUE;
CREATE CONSTRAINT symbol_identity IF NOT EXISTS FOR (n:Symbol) REQUIRE (n.repository_id, n.qualified_name) IS UNIQUE;
CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (n:Chunk) REQUIRE n.id IS UNIQUE;
