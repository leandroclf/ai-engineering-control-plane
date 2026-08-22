export class ProgressDetector {
  constructor({ repeatedThreshold = 2 } = {}) {
    this.repeatedThreshold = repeatedThreshold;
    this.lastKey = undefined;
    this.repeats = 0;
  }

  observe({ finding, diff }) {
    const key = `${finding}:${diff}`;
    this.repeats = key === this.lastKey ? this.repeats + 1 : 1;
    this.lastKey = key;
    if (this.repeats >= this.repeatedThreshold) {
      return { stop: true, reason: "NO_PROGRESS" };
    }
    return { stop: false };
  }
}
