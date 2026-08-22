export class MavenProjectAdapter { async detect() { return { kind: "maven", languages: ["java"], capabilities: {
  build: { command: ["mvn", "-B", "-DskipTests", "package"], required: true }, lint: { command: ["mvn", "-B", "validate"], required: true },
  "changed-tests": { command: ["mvn", "-B", "test"], required: true }, "unit-tests": { command: ["mvn", "-B", "test"], required: true },
  "integration-tests": { command: ["mvn", "-B", "verify"], required: false }, coverage: { command: ["mvn", "-B", "jacoco:report"], required: false },
}, dependencyFiles: ["pom.xml"], sourceRoots: ["src/main"], testRoots: ["src/test"] }; } }
