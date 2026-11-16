/** Connector tools (Slack/Linear) are never offered to benchmark runs. */
export const toolRegistry = {
  async executeTool(): Promise<{ success: boolean; output: string; error?: string }> {
    return { success: false, output: '', error: 'connectors are not available in the benchmark' };
  },
};
