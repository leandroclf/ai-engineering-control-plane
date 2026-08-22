const fingerprintPattern = /^sha256:[a-f0-9]{64}$/;
const ticketPattern = /^(?:[A-Z][A-Z0-9]+-[0-9]+|https:\/\/[^\s]+)$/;

function error(record, code, message) {
  return { id: record?.id ?? null, code, message };
}

function validate(record, now) {
  const errors = [];
  if (!record?.id) errors.push(error(record, "MISSING_ID", "suppression id is required"));
  if (!record?.tool || record.tool.includes("*")) errors.push(error(record, "INVALID_TOOL", "exact tool is required"));
  if (!record?.ruleId || record.ruleId.includes("*")) errors.push(error(record, "INVALID_RULE", "exact ruleId is required"));
  if (!fingerprintPattern.test(record?.fingerprint ?? "")) {
    errors.push(error(record, "INVALID_FINGERPRINT", "exact sha256 fingerprint is required"));
  }
  if (typeof record?.reason !== "string" || record.reason.trim().length < 20) {
    errors.push(error(record, "INVALID_REASON", "reviewable reason of at least 20 characters is required"));
  }
  if (!record?.owner) errors.push(error(record, "MISSING_OWNER", "owner is required"));
  if (!ticketPattern.test(record?.ticket ?? "")) errors.push(error(record, "INVALID_TICKET", "issue key or HTTPS ticket is required"));
  const approvedAt = new Date(record?.approval?.approvedAt ?? "invalid");
  const expiresAt = new Date(record?.expiresAt ?? "invalid");
  if (!record?.approval?.approver) errors.push(error(record, "MISSING_APPROVER", "approver is required"));
  if (record?.approval?.approver === record?.owner) {
    errors.push(error(record, "NON_INDEPENDENT_APPROVAL", "owner cannot approve their own suppression"));
  }
  if (Number.isNaN(approvedAt.valueOf()) || approvedAt > now) {
    errors.push(error(record, "INVALID_APPROVAL_DATE", "approval date must be valid and not in the future"));
  }
  if (Number.isNaN(expiresAt.valueOf())) errors.push(error(record, "INVALID_EXPIRY", "valid expiry is required"));
  return { errors, expired: !Number.isNaN(expiresAt.valueOf()) && expiresAt <= now };
}

export function evaluateSuppressions(document, findings, { now = new Date() } = {}) {
  const errors = [];
  const expired = [];
  if (document?.version !== 1 || !Array.isArray(document?.suppressions)) {
    return { findings: structuredClone(findings), errors: [error(null, "INVALID_DOCUMENT", "version 1 suppressions array is required")], expired };
  }
  const active = [];
  const ids = new Set();
  for (const record of document.suppressions) {
    const validation = validate(record, now);
    errors.push(...validation.errors);
    if (ids.has(record.id)) errors.push(error(record, "DUPLICATE_ID", "suppression id must be unique"));
    ids.add(record.id);
    if (!validation.errors.length && validation.expired) expired.push({ id: record.id, expiresAt: record.expiresAt });
    if (!validation.errors.length && !validation.expired) active.push(record);
  }
  const governed = findings.map((finding) => {
    const suppression = active.find((record) => record.tool === finding.tool
      && record.ruleId === finding.ruleId && record.fingerprint === finding.fingerprint);
    if (!suppression) return structuredClone(finding);
    return {
      ...structuredClone(finding),
      status: "suppressed",
      suppression: {
        id: suppression.id,
        owner: suppression.owner,
        approver: suppression.approval.approver,
        ticket: suppression.ticket,
        expiresAt: suppression.expiresAt,
      },
    };
  });
  return { findings: governed, errors, expired };
}
