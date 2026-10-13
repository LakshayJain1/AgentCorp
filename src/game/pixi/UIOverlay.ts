import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { AgentManager } from './AgentManager';
import { CANVAS } from './PixiOfficeLayout';
import { useGameStore } from '@/store/gameStore';

export class UIOverlay {
  private app: Application;
  private agentManager: AgentManager;
  private hudContainer: Container;
  private hudText: Text;
  private selectedAgentPanel: Container | null = null;

  constructor(app: Application, agentManager: AgentManager) {
    this.app = app;
    this.agentManager = agentManager;
    this.hudContainer = new Container();
    this.hudContainer.zIndex = 100;
    this.app.stage.addChild(this.hudContainer);

    // HUD Text
    const hudStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 10,
      fill: 0x00f5ff,
      padding: 4,
    });
    this.hudText = new Text({ text: '', style: hudStyle });
    this.hudText.position.x = 4;
    this.hudText.position.y = 4;
    this.hudContainer.addChild(this.hudText);

    // Subscribe to selection changes
    this.subscribeToSelection();
  }

  private subscribeToSelection(): void {
    // We'll update selection panel in update()
  }

  update(): void {
    const store = useGameStore.getState();
    const activeAgents = store.agents.filter(a => a.workStatus !== 'idle').length;

    this.hudText.text = 
      `AGENTCORP | ${store.agents.length} AGENTS | ${activeAgents} ACTIVE | ${store.tasks.length} TASKS | ⚡${Math.round(store.simulation.efficiency)}%`;

    // Update selected agent panel (if needed)
    this.updateSelectedAgentPanel(store);
  }

  private updateSelectedAgentPanel(store: ReturnType<typeof useGameStore.getState>): void {
    const selectedId = store.selectedAgentId;
    const selectedAgent = selectedId ? store.agents.find(a => a.id === selectedId) : null;

    if (selectedAgent) {
      if (!this.selectedAgentPanel) {
        this.createSelectedAgentPanel(selectedAgent);
      } else {
        this.updateSelectedAgentPanelContent(selectedAgent);
      }
    } else {
      if (this.selectedAgentPanel) {
        this.hudContainer.removeChild(this.selectedAgentPanel);
        this.selectedAgentPanel.destroy();
        this.selectedAgentPanel = null;
      }
    }
  }

  private createSelectedAgentPanel(agent: ReturnType<typeof useGameStore.getState>['agents'][0]): void {
    this.selectedAgentPanel = new Container();
    this.selectedAgentPanel.zIndex = 101;
    this.selectedAgentPanel.position.x = CANVAS.width - 220;
    this.selectedAgentPanel.position.y = 4;

    const bg = new Graphics();
    bg.roundRect(0, 0, 210, 180, 8);
    bg.fill(0x0a0a1e, 0.95);
    bg.stroke({ width: 1, color: 0x2d2d5e, alpha: 0.5 });
    this.selectedAgentPanel.addChild(bg);

    const style = new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: 0xffffff });
    const styleBold = new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: 0x00f5ff, fontWeight: 'bold' });

    const lines = [
      { label: 'NAME: ', value: agent.name },
      { label: 'ROLE: ', value: agent.role.toUpperCase() },
      { label: 'ENERGY: ', value: `${Math.round(agent.energy)}%` },
      { label: 'MOOD: ', value: agent.mood.toUpperCase() },
      { label: 'STATUS: ', value: agent.workStatus.toUpperCase() },
      { label: 'EFFICIENCY: ', value: `${Math.round(agent.efficiency)}%` },
      { label: 'TASKS DONE: ', value: agent.performance?.tasksCompleted?.toString() ?? '0' },
      { label: 'SUCCESS RATE: ', value: `${Math.round((agent.performance?.successRate ?? 1) * 100)}%` },
    ];

    let y = 8;
    for (const line of lines) {
      const labelText = new Text({ text: line.label, style: styleBold });
      labelText.position.x = 8;
      labelText.position.y = y;
      this.selectedAgentPanel.addChild(labelText);

      const valueText = new Text({ text: line.value, style });
      valueText.position.x = 8 + labelText.width + 4;
      valueText.position.y = y;
      this.selectedAgentPanel.addChild(valueText);

      y += 20;
    }

    this.hudContainer.addChild(this.selectedAgentPanel);
  }

  private updateSelectedAgentPanelContent(agent: ReturnType<typeof useGameStore.getState>['agents'][0]): void {
    if (!this.selectedAgentPanel) return;

    // Update text children - simplified approach: recreate
    this.hudContainer.removeChild(this.selectedAgentPanel);
    this.selectedAgentPanel.destroy();
    this.selectedAgentPanel = null;
    this.createSelectedAgentPanel(agent);
  }

  destroy(): void {
    this.hudContainer.destroy({ children: true });
  }
}