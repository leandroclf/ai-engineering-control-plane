const requiredStrings = ["id", "boundary", "threat", "mitigation", "test", "evidence", "owner", "status"];
const riskRatings = new Set(["low", "medium", "high", "critical"]);
const statuses = new Set(["mitigated", "open", "accepted"]);

export function validateThreatMatrix(matrix) {
  const errors = [];
  if (matrix?.schemaVersion !== 1 || !Array.isArray(matrix?.threats)) {
    return { errors: ["schemaVersion 1 threats array is required"], boundaries: [], openRisks: [] };
  }
  const ids = new Set();
  for (const [index, threat] of matrix.threats.entries()) {
    for (const field of requiredStrings) {
      if (typeof threat?.[field] !== "string" || !threat[field].trim()) errors.push(`threat[${index}].${field} is required`);
    }
    if (ids.has(threat.id)) errors.push(`duplicate threat id: ${threat.id}`);
    ids.add(threat.id);
    if (!statuses.has(threat.status)) errors.push(`threat[${index}].status is invalid`);
    if (!riskRatings.has(threat.residualRisk?.rating) || !threat.residualRisk?.rationale) {
      errors.push(`threat[${index}].residualRisk requires rating and rationale`);
    }
  }
  return {
    errors,
    boundaries: [...new Set(matrix.threats.map((threat) => threat.boundary))],
    openRisks: matrix.threats.filter((threat) => threat.status === "open").map((threat) => threat.id),
  };
}
