import { Application, Assets } from 'pixi.js';
import { useGameStore } from '@/store/gameStore';
import { startEngine } from '@/engine/EngineRuntime';
import { CANVAS } from './PixiOfficeLayout';
import { AgentManager } from './AgentManager';
import { OfficeRenderer } from './OfficeRenderer';
import { UIOverlay } from './UIOverlay';
import { SimulationLoop } from './SimulationLoop';

/**
 * Purely visual office. Agent bootstrap, workers and the orchestrator tick live
 * in EngineRuntime, so this class can fail (no WebGL), be destroyed and be
 * re-created (office tab opened/closed, React strict-mode double mount) without
 * affecting the team.
 *
 * One PixiGame per mounted canvas (the workspace renders the centre panel in both
 * a desktop and a CSS-hidden mobile layout, so a global singleton would fight
 * itself). Every initialize() call owns a private Session. Aborting or failing an init
 * only ever disposes that init's own resources — never the ones a newer init
 * has since put in place.
 */

interface Session {
  container: HTMLElement;
  app: Application | null;
  agentManager: AgentManager | null;
  officeRenderer: OfficeRenderer | null;
  uiOverlay: UIOverlay | null;
  simulationLoop: SimulationLoop | null;
  onWindowResize: (() => void) | null;
  rendererType: string | null;
  ready: boolean;
}

function dispose(s: Session): void {
  const safely = (fn: () => void) => { try { fn(); } catch (e) { console.warn('[PixiGame] dispose step failed:', e); } };
  safely(() => s.simulationLoop?.stop());
  safely(() => s.agentManager?.destroy());
  safely(() => s.officeRenderer?.destroy());
  safely(() => s.uiOverlay?.destroy());
  safely(() => { if (s.app) s.app.destroy(true); });
  safely(() => { if (s.onWindowResize) window.removeEventListener('resize', s.onWindowResize); });
  s.simulationLoop = null;
  s.agentManager = null;
  s.officeRenderer = null;
  s.uiOverlay = null;
  s.app = null;
  s.onWindowResize = null;
  s.ready = false;
}

export class PixiGame {
  /** The live session, if any. Only set once an init has fully succeeded. */
  private active: Session | null = null;
  /** Bumped by every initialize() and destroy(); an in-flight init aborts when it changes. */
  private generation = 0;

  get rendererType(): string | null {
    return this.active?.rendererType ?? null;
  }

  async initialize(container: HTMLElement): Promise<void> {
    if (this.active?.ready && this.active.container === container) return;
    // Replace whatever was there (a previous init for a stale container).
    if (this.active) { dispose(this.active); this.active = null; }

    const gen = ++this.generation;
    const aborted = () => gen !== this.generation;
    const s: Session = {
      container, app: null, agentManager: null, officeRenderer: null, uiOverlay: null,
      simulationLoop: null, onWindowResize: null, rendererType: null, ready: false,
    };

    try {
      // The engine must be up before we read agents from the store.
      await startEngine();
      if (aborted()) return;

      await Assets.init();
      if (aborted()) return;

      const rect = container.getBoundingClientRect();
      const initialWidth = rect.width > 0 ? rect.width : (container.clientWidth > 0 ? container.clientWidth : CANVAS.width);
      const initialHeight = rect.height > 0 ? rect.height : (container.clientHeight > 0 ? container.clientHeight : CANVAS.height);

      const app = new Application();
      s.app = app;
      await app.init({
        width: initialWidth,
        height: initialHeight,
        background: 0x0a0a1e,
        // Cap resolution at 2× — mobile devices at 3× DPR can exceed WebGL texture limits
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        antialias: false,
        // 'high-performance' fails silently on iOS Safari / Android WebView
        powerPreference: 'low-power',
        // WebGPU is excluded (partially implemented on some mobile browsers and
        // throws during init). If WebGL is unavailable Pixi falls back to its
        // Canvas2D renderer instead of failing outright.
        preference: ['webgl', 'canvas'],
      });
      if (aborted()) { dispose(s); return; }
      s.rendererType = (app.renderer as unknown as { name?: string }).name ?? null;

      container.appendChild(app.canvas);
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      app.canvas.style.display = 'block';

      s.officeRenderer = new OfficeRenderer(app);
      s.agentManager = new AgentManager(app);
      s.uiOverlay = new UIOverlay(app, s.agentManager);
      s.simulationLoop = new SimulationLoop(app, s.agentManager, s.uiOverlay);

      const resize = (w: number, h: number) => {
        if (w <= 0 || h <= 0) return;
        app.renderer?.resize(w, h);
        s.officeRenderer?.resize(w, h);
        s.agentManager?.resize(w, h);
        s.uiOverlay?.resize(w, h);
      };
      resize(initialWidth, initialHeight);

      await s.agentManager.loadSprites();
      if (aborted()) { dispose(s); return; }

      s.agentManager.createAgents(useGameStore.getState().agents);
      s.simulationLoop.start();

      s.onWindowResize = () => {
        const r = container.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) resize(r.width, r.height);
      };
      window.addEventListener('resize', s.onWindowResize);

      s.ready = true;
      this.active = s;
      console.log(`[PixiGame] Initialized (${s.rendererType ?? 'unknown'} renderer)`);
    } catch (err) {
      // Dispose only what THIS init created, so a retry starts clean.
      dispose(s);
      if (container.isConnected) { try { container.innerHTML = ''; } catch { /* ignore */ } }
      throw err;
    }
  }

  resize(width: number, height: number): void {
    const s = this.active;
    if (!s?.app || width <= 0 || height <= 0) return;
    s.app.renderer?.resize(width, height);
    s.officeRenderer?.resize(width, height);
    s.agentManager?.resize(width, height);
    s.uiOverlay?.resize(width, height);
  }

  destroy(): void {
    this.generation++; // aborts any in-flight initialize()
    const s = this.active;
    this.active = null;
    if (s) {
      dispose(s);
      try { s.container.innerHTML = ''; } catch { /* ignore */ }
    }
    console.log('[PixiGame] Destroyed');
  }

  isInitialized(): boolean {
    return !!this.active?.ready;
  }

  getApp(): Application | null {
    return this.active?.app ?? null;
  }
}

