export class ParserRegistry {
  constructor(parsers = []) {
    if (!parsers.length) throw new TypeError("at least one source parser is required");
    this.parsers = [...parsers];
  }
  supports(path) { return this.parsers.some((parser) => parser.supports(path)); }
  parserFor(path) {
    const matches = this.parsers.filter((parser) => parser.supports(path));
    if (matches.length !== 1) throw new Error(matches.length ? `AMBIGUOUS_SOURCE_PARSER:${path}` : `UNSUPPORTED_SOURCE_LANGUAGE:${path}`);
    return matches[0];
  }
  parse(input) { return this.parserFor(input.path).parse(input); }
}

