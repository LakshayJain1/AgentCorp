import { ExecutionStreamChunk, StreamEvent } from '@/agents/AgentTypes';

export class ExecutionLogStream {
  private chunks: ExecutionStreamChunk[] = [];
  private listeners: Set<(chunk: ExecutionStreamChunk) => void> = new Set();
  private readonly maxChunks = 200;

  onChunk(cb: (chunk: ExecutionStreamChunk) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  push(chunk: ExecutionStreamChunk): void {
    this.chunks.push(chunk);
    if (this.chunks.length > this.maxChunks) {
      this.chunks = this.chunks.slice(-this.maxChunks);
    }
    for (const cb of this.listeners) cb(chunk);
  }

  getRecent(limit: number = 50): ExecutionStreamChunk[] {
    return this.chunks.slice(-limit);
  }

  getByTaskId(taskId: string): ExecutionStreamChunk[] {
    return this.chunks.filter((c) => c.taskId === taskId);
  }

  getBySubtaskId(subtaskId: string): ExecutionStreamChunk[] {
    return this.chunks.filter((c) => c.subtaskId === subtaskId);
  }

  clear(): void {
    this.chunks = [];
  }

  get length(): number {
    return this.chunks.length;
  }
}
