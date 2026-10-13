import { Application, Ticker } from 'pixi.js';
import { AgentManager } from './AgentManager';
import { UIOverlay } from './UIOverlay';
import { useGameStore } from '@/store/gameStore';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';
import { updateAgentMoods } from '@/systems/ConversationSystem';

export class SimulationLoop {
  private app: Application;
  private agentManager: AgentManager;
  private uiOverlay: UIOverlay;
  private frameCount = 0;
  private processing = false;
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

    // CentralOrchestrator tick (~30 frames at speed 1)
    const orchestratorInterval = Math.max(1, Math.floor(30 / speed));
    if (this.frameCount % orchestratorInterval === 0) {
      if (!this.processing) {
        this.processing = true;
        centralOrchestrator.tick().finally(() => {
          this.processing = false;
        });
      }
    }

    // Agent mood decay (energy-driven, no chatter)
    const moodInterval = Math.max(1, Math.floor(20 / speed));
    if (this.frameCount % moodInterval === 0) {
      updateAgentMoods();
    }

    // Update agents
    this.agentManager.update(adjustedDt, speed);

    // Sync from store to entities (every frame for smooth movement)
    this.agentManager.syncFromStore();

    // Sync entities to store (every 6 frames = 10fps at 60fps)
    if (this.frameCount % 6 === 0) {
      this.syncAgentsToStore();
      this.syncSimulationMetrics();
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

  private syncSimulationMetrics(): void {
    const store = useGameStore.getState();
    const entities = this.agentManager.getAllAgents();
    
    // Calculate CPU usage based on active agents and their state
    const activeAgents = entities.filter(a => a.workStatus !== 'idle').length;
    const workingAgents = entities.filter(a => a.workStatus === 'coding' || a.workStatus === 'debugging' || a.workStatus === 'researching').length;
    
    // CPU usage: base 15% + 5% per active agent + 3% per working agent
    const cpuUsage = Math.min(95, 15 + activeAgents * 5 + workingAgents * 3);
    
    // Memory usage: base 2.0 GB + 0.1 GB per agent + 0.05 GB per task
    const memoryUsage = Math.min(8.0, 2.0 + entities.length * 0.1 + store.tasks.length * 0.05);
    
    // Update simulation metrics
    store.updateSimulation({
      cpuUsage: Math.round(cpuUsage),
      memoryUsage: Number(memoryUsage.toFixed(1)),
      tick: store.simulation.tick + 1,
    });
  }
}