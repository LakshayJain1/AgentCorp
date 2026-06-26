export class TaskDiscovery {
  async scanProject(): Promise<{ title: string; source: string; contextFile?: string }[]> {
    return [];
  }
}

export const taskDiscovery = new TaskDiscovery();
