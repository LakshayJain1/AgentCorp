import { Application, Ticker } from 'pixi.js';
import { AgentManager } from './AgentManager';
import { UIOverlay } from './UIOverlay';
import { useGameStore } from '@/store/gameStore';

export class SimulationLoop {
  private app: Application;
  private agentManager: AgentManager;
  private uiOverlay: UIOverlay;
  private frameCount = 0;
  private lastTime = 0;
  private running = false;

  constructor(app: Application, agentManager: AgentManager, uiOverlay: UIOverlay) {
    this.app = app;
    this.agentManager = agentManager;
    this.uiOverlay = uiOverlay;
  }

  start(): void {
    if (this.running) return;
    
    // In PixiJS v8, ensure ticker exists. It should be initialized after app.init()
    const ticker = this.app.ticker;
    if (!ticker) {
      console.error('[SimulationLoop] app.ticker is null. Application might not be initialized.');
      return;
    }

    this.running = true;
    this.lastTime = performance.now();
    
    // Add to PixiJS ticker
    ticker.add(this.tick, this);
    console.log('[SimulationLoop] Started');
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.app.ticker?.remove(this.tick, this);
    console.log('[SimulationLoop] Stopped');
  }

  private tick = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;

    const store = useGameStore.getState();
    if (store.simulation.paused) {
      // Still render UI
      this.uiOverlay.update();
      return;
    }

    const speed = store.simulation.speed;
    const adjustedDt = dt * speed;
    this.frameCount++;

    // NOTE: the orchestrator tick, mood decay and simulation metrics live in
    // EngineRuntime now — this loop is visual only.

    // Update agents
    this.agentManager.update(adjustedDt, speed);

    // Sync from store to entities (every frame for smooth movement)
    this.agentManager.syncFromStore();

    // Sync entities to store (every 6 frames = 10fps at 60fps)
    if (this.frameCount % 6 === 0) {
      this.syncAgentsToStore();
    }

    // Update UI
    this.uiOverlay.update();
  };

  private syncAgentsToStore(): void {
    const store = useGameStore.getState();
    const entities = this.agentManager.getAllAgents();
    
    const updates = entities.map(entity => {
      let state = entity.state;
      const ws = entity.workStatus;
      if (ws === 'coding' || ws === 'debugging' || ws === 'researching') state = 'working';
      else if (ws === 'thinking') state = 'communicating';

      return {
        id: entity.id,
        x: entity.x,
        y: entity.y,
        state,
        energy: Math.round(Math.max(0, entity.energy)),
        mood: ws === 'blocked' ? 'frustrated' : entity.mood,
        cooldownRemainingSeconds: entity.cooldownRemainingSeconds,
        cooldownType: entity.cooldownType,
        name: entity.name,
        efficiency: entity.efficiency,
        online: entity.online,
        workStatus: entity.workStatus,
        fsmState: entity.fsmState,
        performance: entity.performance,
      };
    });

    store.syncAgents(updates);
  }

  isRunning(): boolean {
    return this.running;
  }
}
