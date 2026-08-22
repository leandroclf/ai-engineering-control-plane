export class Workflow {
  constructor(definition) {
    if (!definition?.initial || !definition?.states?.[definition.initial]) {
      throw new TypeError("workflow requires a valid initial state");
    }
    this.definition = structuredClone(definition);
    this.terminals = new Set(definition.terminal ?? []);
  }

  transition(current, outcome) {
    const state = this.definition.states[current];
    if (!state) throw new Error(`unknown workflow state: ${current}`);
    const next = state.next?.[outcome];
    if (!next) throw new Error(`outcome ${outcome} is not declared for ${current}`);
    if (!this.definition.states[next]) throw new Error(`transition targets unknown state: ${next}`);
    return next;
  }

  isTerminal(state) {
    return this.terminals.has(state);
  }
}
