export class PythonProjectAdapter { async detect() { return { kind: "python", languages: ["python"], capabilities: {
  build: { command: ["python3", "-m", "compileall", "-q", "."], required: true }, lint: { command: ["python3", "-m", "ruff", "check", "."], required: false },
  "changed-tests": { command: ["python3", "-m", "pytest", "-q"], required: true }, "unit-tests": { command: ["python3", "-m", "pytest", "-q"], required: true },
  "integration-tests": { command: ["python3", "-m", "pytest", "-q", "tests/integration"], required: false }, coverage: { command: ["python3", "-m", "pytest", "--cov", "--cov-report=term"], required: false },
}, dependencyFiles: ["pyproject.toml", "requirements.txt"], sourceRoots: ["src"], testRoots: ["tests"] }; } }
