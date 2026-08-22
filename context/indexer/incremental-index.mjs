export function planIncrementalIndex(previous, files, versions) {
  const currentPaths = new Set(files.map(({ path }) => path));
  const changed = [];
  const reused = [];
  for (const file of files) {
    const known = previous.get(file.path);
    if (
      known?.oid === file.oid &&
      known.parserVersion === versions.parserVersion &&
      known.schemaVersion === versions.schemaVersion
    ) {
      reused.push(file.path);
    } else {
      changed.push(file.path);
    }
  }
  const deleted = [...previous.keys()].filter((path) => !currentPaths.has(path));
  return {
    changed: changed.sort(),
    deleted: deleted.sort(),
    reused: reused.sort(),
  };
}
