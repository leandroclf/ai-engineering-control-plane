export class GoProjectAdapter { async detect() { return { kind: "go", languages: ["go"], capabilities: {
  build: { command: ["go", "build", "./..."], required: true }, lint: { command: ["go", "vet", "./..."], required: true },
  "changed-tests": { command: ["go", "test", "./..."], required: true }, "unit-tests": { command: ["go", "test", "./..."], required: true },
  "integration-tests": { command: ["go", "test", "-tags=integration", "./..."], required: false }, coverage: { command: ["go", "test", "-coverprofile=coverage.out", "./..."], required: false },
}, dependencyFiles: ["go.mod", "go.sum"], sourceRoots: ["."], testRoots: ["."] }; } }
