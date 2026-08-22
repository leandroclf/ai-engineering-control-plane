CREATE CONSTRAINT external_reference_id IF NOT EXISTS FOR (n:ExternalReference) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT module_identity IF NOT EXISTS FOR (n:Module) REQUIRE (n.repository_id, n.path) IS UNIQUE;
CREATE INDEX symbol_qualified_name IF NOT EXISTS FOR (n:Symbol) ON (n.qualified_name);
CREATE INDEX symbol_language IF NOT EXISTS FOR (n:Symbol) ON (n.language);

