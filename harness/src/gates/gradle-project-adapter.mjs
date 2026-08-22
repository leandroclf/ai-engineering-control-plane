import { access } from "node:fs/promises";
import { join } from "node:path";
async function exists(path) { try { await access(path); return true; } catch { return false; } }
export class GradleProjectAdapter {
  async detect(project) {
    const wrapper = await exists(join(project, "gradlew"));
    const gradle = wrapper ? "./gradlew" : "gradle";
    return { kind: "gradle", languages: ["java"], capabilities: {
      build: { command: [gradle, "assemble"], required: true }, lint: { command: [gradle, "check"], required: true },
      "changed-tests": { command: [gradle, "test"], required: true }, "unit-tests": { command: [gradle, "test"], required: true },
      "integration-tests": { command: [gradle, "integrationTest"], required: false }, coverage: { command: [gradle, "jacocoTestReport"], required: false },
    }, dependencyFiles: ["build.gradle", "build.gradle.kts", "gradle/libs.versions.toml"], sourceRoots: ["src/main"], testRoots: ["src/test"] };
  }
}
