export class ProviderHostClient {
  constructor(host) { if (!host?.execute) throw new TypeError("provider host is required"); this.host = host; }
  execute(request) { return this.host.execute(request); }
  cancel(executionId) { return this.host.cancel(executionId); }
}
