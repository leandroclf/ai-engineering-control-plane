export class AgentMetrics {
  #counters = new Map();
  #durations = new Map();
  increment(name, value = 1) { this.#counters.set(name, (this.#counters.get(name) ?? 0) + value); }
  observe(name, value) { const values = this.#durations.get(name) ?? []; values.push(value); this.#durations.set(name, values); }
  snapshot() {
    return {
      counters: Object.fromEntries(this.#counters),
      durations: Object.fromEntries([...this.#durations].map(([name, values]) => [name, { count: values.length, total: values.reduce((sum, item) => sum + item, 0), max: Math.max(...values) }])),
    };
  }
}
