export class Sandbox {
  constructor() {}

  getConfig() {
    return { enabled: false, allowedPaths: [], allowedCommands: [] };
  }

  updateConfig() {}
}

export const globalSandbox = new Sandbox();
