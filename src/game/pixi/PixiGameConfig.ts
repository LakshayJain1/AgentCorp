import { Application, Assets } from 'pixi.js';
import { useGameStore } from '@/store/gameStore';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';
import { preloadAllConfigs } from '@/config/preload';
import { CANVAS } from './PixiOfficeLayout';
import { AgentManager } from './AgentManager';
import { OfficeRenderer } from './OfficeRenderer';
import { UIOverlay } from './UIOverlay';
import { SimulationLoop } from './SimulationLoop';

export class PixiGame {
  private app: Application | null = null;
  private agentManager: AgentManager | null = null;
  private officeRenderer: OfficeRenderer | null = null;
  private uiOverlay: UIOverlay | null = null;
  private simulationLoop: SimulationLoop | null = null;
  private container: HTMLElement | null = null;
  private initialized = false;
  private boundHandleResize: () => void = this.handleResize.bind(this);

  async initialize(container: HTMLElement): Promise<void> {
    if (this.initialized) return;
    this.container = container;

    // Initialize Pixi Assets (required in v8)
    await Assets.init();

    // Create Pixi Application
    this.app = new Application();
    await this.app.init({
      width: CANVAS.width,
      height: CANVAS.height,
      background: 0x0a0a1e,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
      powerPreference: 'high-performance',
    });


    // Mount canvas
    container.appendChild(this.app.canvas);
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.display = 'block';

    // Initialize renderers
    this.officeRenderer = new OfficeRenderer(this.app);
    this.agentManager = new AgentManager(this.app);
    this.uiOverlay = new UIOverlay(this.app, this.agentManager);
    this.simulationLoop = new SimulationLoop(this.app, this.agentManager, this.uiOverlay);

    // Preload configs
    await preloadAllConfigs();

    // Initialize store agents
    const store = useGameStore.getState();
    store.initAgents();
    centralOrchestrator.initWorkers();

    // Load sprites before creating entities
    await this.agentManager.loadSprites();

    // Create agent entities from store
    const agents = store.agents;
    this.agentManager.createAgents(agents);

    // Start simulation
    this.simulationLoop.start();

    // Window resize handler (sidebar / split-pane changes use ResizeObserver in GameCanvas)
    window.addEventListener('resize', this.boundHandleResize);

    this.initialized = true;
    console.log('[PixiGame] Initialized');
  }

  resize(width: number, height: number): void {
    if (!this.app || width <= 0 || height <= 0) return;
    this.app.renderer.resize(width, height);
  }

  private handleResize(): void {
    if (!this.app || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.app.renderer.resize(rect.width, rect.height);
    }
  }

  destroy(): void {
    if (!this.initialized) return;

    this.simulationLoop?.stop();
    this.agentManager?.destroy();
    this.officeRenderer?.destroy();
    this.uiOverlay?.destroy();

    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    window.removeEventListener('resize', this.boundHandleResize);
    this.initialized = false;
    console.log('[PixiGame] Destroyed');
  }

  getApp(): Application | null {
    return this.app;
  }
}

export const pixiGame = new PixiGame();