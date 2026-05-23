import { StreamEvent, ExecutionStreamChunk } from '@/agents/AgentTypes';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';

type SSEClient = {
  id: string;
  send: (event: string, data: string) => void;
};

export class LiveServer {
  private clients: Map<string, SSEClient> = new Map();
  private eventBuffer: StreamEvent[] = [];
  private readonly maxBufferSize = 100;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.unsubscribe = centralOrchestrator.onEvent((event) => {
      this.broadcast(event);
    });
  }

  addClient(id: string, send: (event: string, data: string) => void): void {
    this.clients.set(id, { id, send });
    // Send buffered events on connect
    for (const event of this.eventBuffer) {
      send('event', JSON.stringify(event));
    }
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  broadcast(event: StreamEvent): void {
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.maxBufferSize);
    }

    const data = JSON.stringify(event);
    for (const client of this.clients.values()) {
      try {
        client.send('event', data);
      } catch {
        this.removeClient(client.id);
      }
    }
  }

  sendLogToClient(clientId: string, chunk: ExecutionStreamChunk): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.send('log', JSON.stringify(chunk));
    }
  }

  get activeConnections(): number {
    return this.clients.size;
  }

  destroy(): void {
    this.unsubscribe?.();
    this.clients.clear();
    this.eventBuffer = [];
  }
}

export const liveServer = new LiveServer();

export function createSSEResponse(): Response {
  let clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const stream = new ReadableStream({
    start(controller) {
      liveServer.addClient(clientId, (event, data) => {
        controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${data}\n\n`));
      });

      // Send initial connection event
      controller.enqueue(new TextEncoder().encode(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`));
    },
    cancel() {
      liveServer.removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
