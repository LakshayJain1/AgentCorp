import Phaser from 'phaser';
import { useGameStore } from '@/store/gameStore';
import { Agent } from '@/agents/AgentTypes';
import { OFFICE_LOCATIONS } from '@/store/gameStore';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';
import { preloadAllConfigs } from '@/config/preload';
import { maybeStartConversation, updateAgentMoods } from '@/systems/ConversationSystem';
import { generateAmbientChatter } from '@/systems/EventSystem';
import { CANVAS, ZONES, DESK_POSITIONS, MEETING_AREA } from './officeLayout';

const AGENT_SPEED = 1.2;

export class GameScene extends Phaser.Scene {
  private officeGraphics!: Phaser.GameObjects.Graphics;
  private agentGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private agentLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private agentSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private agentBubbles: Map<string, Phaser.GameObjects.Container> = new Map();
  private hudText!: Phaser.GameObjects.Text;
  private frameCount = 0;
  private processing = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Load agent sprites for each role
    const roles = ['ceo', 'hr', 'pm', 'researcher', 'engineer', 'qa'] as const;
    for (const role of roles) {
      this.load.image(`agent_desk_${role}`, `/sprites/agents/${role}.png`);
      this.load.image(`agent_walk_${role}`, `/sprites/agents/walk/${role}.png`);
    }
    // Fallback
    this.load.image('agent', '/sprites/agent.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0a1e');

    this.officeGraphics = this.add.graphics();
    this.drawOffice();

    const store = useGameStore.getState();
    preloadAllConfigs().then(() => {
      console.log('[GameScene] Configs preloaded');
    });
    store.initAgents();
    centralOrchestrator.initWorkers();

    const freshAgents = useGameStore.getState().agents;
    freshAgents.forEach((agent) => {
      const g = this.add.graphics().setDepth(20);
      this.agentGraphics.set(agent.id, g);
      const label = this.add.text(agent.x, agent.y - 50, agent.name, {
        font: '11px monospace',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      }).setDepth(50);
      this.agentLabels.set(agent.id, label);

      // Determine sprite based on role
      const roleKey = agent.role === 'engineer' ? 'engineer' : agent.role;
      const textureKey = this.textures.exists(`agent_desk_${roleKey}`)
        ? `agent_desk_${roleKey}`
        : 'agent';
      const sprite = this.add.image(agent.x, agent.y, textureKey);
      sprite.setDepth(10);
      sprite.setScale(0.005);
      this.agentSprites.set(agent.id, sprite);

      const bubbleBg = this.add.graphics();
      const bubbleText = this.add.text(0, 0, '', {
        font: '9px monospace',
        color: '#ffffff',
        wordWrap: { width: 100 },
      });
      const bubble = this.add.container(0, 0, [bubbleBg, bubbleText]);
      bubble.setDepth(60);
      bubble.setVisible(false);
      bubbleText.setOrigin(0.5, 0.5);
      this.agentBubbles.set(agent.id, bubble);
    });
    console.log('[GameScene] Agents created:', freshAgents.length);

    this.hudText = this.add.text(4, 4, '', {
      font: '10px monospace',
      color: '#00f5ff',
      backgroundColor: '#0a0a1eaa',
      padding: { x: 4, y: 2 },
    }).setDepth(100);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const agents = useGameStore.getState().agents;
      for (const agent of agents) {
        if (Math.abs(pointer.x - agent.x) < 50 && Math.abs(pointer.y - agent.y) < 60) {
          useGameStore.getState().setSelectedAgent(agent.id);
          return;
        }
      }
      useGameStore.getState().setSelectedAgent(null);
    });
  }

  update(_time: number, delta: number): void {
    const store = useGameStore.getState();
    if (store.simulation.paused) return;

    const speed = store.simulation.speed;
    const dt = delta * speed;
    this.frameCount++;

    if (this.frameCount % Math.max(1, Math.floor(30 / speed)) === 0) {
      if (!this.processing) {
        this.processing = true;
        centralOrchestrator.tick().finally(() => {
          this.processing = false;
        });
      }
    }

    if (this.frameCount % Math.max(1, Math.floor(20 / speed)) === 0) {
      maybeStartConversation();
      updateAgentMoods();
    }
    if (this.frameCount % Math.max(1, Math.floor(10 / speed)) === 0) {
      generateAmbientChatter();
    }

    const agents = [...store.agents];

    agents.forEach((agent, idx) => {
      this.updateMovement(agent, dt);
      this.updateEnergy(agent, dt, idx);
      this.drawAgent(agent);
      this.updateBubble(agent);
    });

    if (this.frameCount % 6 === 0) {
      const storeSync = useGameStore.getState();
      const updates = agents.map((agent) => {
        let state = agent.state;
        const ws = agent.workStatus;
        if (ws === 'coding' || ws === 'debugging' || ws === 'researching') state = 'working';
        else if (ws === 'thinking') state = 'communicating';
        return {
          id: agent.id,
          x: agent.x,
          y: agent.y,
          state,
          energy: Math.round(Math.max(0, agent.energy)),
          mood: ws === 'blocked' ? 'frustrated' as const : agent.mood,
          cooldownRemainingSeconds: agent.cooldownRemainingSeconds,
          cooldownType: agent.cooldownType,
          name: agent.name,
          efficiency: agent.efficiency,
          online: agent.online,
          workStatus: agent.workStatus,
          fsmState: agent.fsmState,
          performance: agent.performance,
        };
      });
      storeSync.syncAgents(updates);
    }

    const activeAgents = store.agents.filter((a) => a.workStatus !== 'idle').length;
    this.hudText.setText(
      `AGENTCORP | ${store.agents.length} AGENTS | ${activeAgents} ACTIVE | ${store.tasks.length} TASKS | ⚡${Math.round(store.simulation.efficiency)}%`,
    );
  }

  private updateMovement(agent: Agent, dt: number): void {
    const dx = agent.targetX - agent.x;
    const dy = agent.targetY - agent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.5) {
      const moveSpeed = AGENT_SPEED * (dt / 16);
      agent.x += (dx / dist) * moveSpeed;
      agent.y += (dy / dist) * moveSpeed;
      agent.state = 'walking';
    } else {
      agent.x = agent.targetX;
      agent.y = agent.targetY;
      if (agent.state === 'walking') agent.state = 'working';
    }
  }

  private updateEnergy(agent: Agent, dt: number, _idx: number): void {
    const store = useGameStore.getState();
    const speed = store.simulation.speed;
    const rate = 0.008 * (dt / 16);

    if (agent.cooldownRemainingSeconds !== undefined && agent.cooldownRemainingSeconds > 0) {
      const elapsedSec = (dt / 1000) * speed;
      agent.cooldownRemainingSeconds = Math.max(0, agent.cooldownRemainingSeconds - elapsedSec);
      agent.workStatus = 'waiting';

      if (agent.cooldownType === 'onboarding') {
        agent.mood = 'neutral';
        const gaming = OFFICE_LOCATIONS().find((l) => l.role === 'gaming');
        const coffee = OFFICE_LOCATIONS().find((l) => l.role === 'coffee');
        const target = gaming || coffee;
        if (target) {
          const dist = Math.sqrt((agent.x - target.x) ** 2 + (agent.y - target.y) ** 2);
          if (dist > 25 && agent.state !== 'walking') {
            agent.targetX = target.x + (Math.random() - 0.5) * 15;
            agent.targetY = target.y + (Math.random() - 0.5) * 15;
            agent.state = 'walking';
          } else if (dist <= 25 && agent.state !== 'walking') {
            agent.state = 'resting';
          }
        }
      } else if (agent.cooldownType === 'burnout') {
        agent.mood = 'happy';
        if (!agent.cooldownTargetLocId) {
          const gaming = OFFICE_LOCATIONS().find((l) => l.role === 'gaming');
          const coffee = OFFICE_LOCATIONS().find((l) => l.role === 'coffee');
          const target = Math.random() < 0.5 ? gaming : coffee;
          agent.cooldownTargetLocId = target?.id || 'gaming_zone';
        }
        const targetLoc = OFFICE_LOCATIONS().find((l) => l.id === agent.cooldownTargetLocId);
        if (targetLoc) {
          const dist = Math.sqrt((agent.x - targetLoc.x) ** 2 + (agent.y - targetLoc.y) ** 2);
          if (dist > 15 && agent.state !== 'walking') {
            agent.targetX = targetLoc.x + (Math.random() - 0.5) * 15;
            agent.targetY = targetLoc.y + (Math.random() - 0.5) * 15;
            agent.state = 'walking';
          } else if (dist <= 15 && agent.state !== 'walking') {
            agent.state = 'resting';
          }
        }
      }

      if (agent.cooldownRemainingSeconds === 0) {
        if (agent.cooldownType === 'onboarding') {
          const finalName = agent.name.replace('Onboarding: ', '');
          agent.name = finalName;
          agent.online = true;
          agent.efficiency = 100;
          agent.energy = 100;
          agent.mood = 'happy';
          agent.workStatus = 'idle';
          agent.fsmState = 'idle';
          agent.performance = {
            tasksCompleted: 0,
            tasksFailed: 0,
            avgCompletionTime: 0,
            successRate: 1,
            collaborationScore: 80,
            reliabilityScore: 90,
            toolUsageCount: 0,
            specializationTags: [],
            seniority: 'junior',
            productivityScore: 100,
            promotionLevel: 'trial',
            reviewsCount: 0,
            lastReviewAt: null,
          };

          store.addEvent({
            id: `onboard_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            type: 'agent',
            message: `🎉 Onboarded new ${agent.role} agent: ${agent.name}! All metrics reset to 100% efficiency.`,
            agentId: agent.id,
            taskId: null,
          });
        } else if (agent.cooldownType === 'burnout') {
          agent.energy = 100;
          agent.efficiency = 100;
          agent.mood = 'focused';
          agent.workStatus = 'idle';
          agent.fsmState = 'idle';

          store.addEvent({
            id: `cooldown_done_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            type: 'agent',
            message: `⚡ ${agent.name} is back from cooldown at 100% efficiency!`,
            agentId: agent.id,
            taskId: null,
          });
        }

        agent.cooldownType = undefined;
        agent.cooldownTargetLocId = undefined;
        agent.cooldownRemainingSeconds = undefined;

        const location = OFFICE_LOCATIONS().find((l) => l.role === agent.role);
        if (location) {
          agent.targetX = location.x;
          agent.targetY = location.y;
          agent.state = 'walking';
        }
      }
      return;
    }

    if (agent.state === 'working' || agent.state === 'walking') {
      agent.energy -= rate * (agent.state === 'walking' ? 1.5 : 2.5);
    }

    if (agent.state === 'working' && agent.online) {
      agent.efficiency = Math.max(10, agent.efficiency - rate * 0.4);
    }

    const isWorker = agent.role === 'engineer' || agent.role === 'qa' || agent.role === 'researcher';
    if (agent.efficiency < 50 && isWorker && !agent.currentSubTaskId && agent.online) {
      agent.cooldownRemainingSeconds = 180 + Math.random() * 60;
      agent.cooldownType = 'burnout';
      agent.workStatus = 'waiting';
      agent.mood = 'tired';
      agent.state = 'resting';

      const coffee = OFFICE_LOCATIONS().find((l) => l.role === 'coffee');
      const gaming = OFFICE_LOCATIONS().find((l) => l.role === 'gaming');
      const target = Math.random() < 0.5 ? gaming : coffee;
      agent.cooldownTargetLocId = target?.id || 'gaming_zone';

      if (target) {
        agent.targetX = target.x + (Math.random() - 0.5) * 15;
        agent.targetY = target.y + (Math.random() - 0.5) * 15;
        agent.state = 'walking';
      }

      store.addEvent({
        id: `burnout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: 'agent',
        message: `💤 ${agent.name} (${agent.role}) feels fatigued (efficiency: ${Math.round(agent.efficiency)}%). Heading to the Coffee/Gaming zone for a break.`,
        agentId: agent.id,
        taskId: null,
      });

      return;
    }

    const coffee = OFFICE_LOCATIONS().find((l) => l.role === 'coffee');
    if (coffee) {
      const dist = Math.sqrt(
        (agent.x - coffee.x) ** 2 + (agent.y - coffee.y) ** 2,
      );
      if (dist < 15) {
        agent.energy = Math.min(100, agent.energy + rate * 25);
        agent.mood = 'happy';
      }
    }

    agent.energy = Math.max(0, Math.min(100, agent.energy));

    const distToTarget = Math.sqrt(
      (agent.x - agent.targetX) ** 2 + (agent.y - agent.targetY) ** 2,
    );

    if (distToTarget < 8 && agent.state !== 'walking') {
      this.pickNextGoal(agent);
    }
  }

  private pickNextGoal(agent: Agent): void {
    const location = OFFICE_LOCATIONS().find((l) => l.role === agent.role);
    const meeting = OFFICE_LOCATIONS().find((l) => l.role === 'meeting');
    const coffee = OFFICE_LOCATIONS().find((l) => l.role === 'coffee');

    const r = Math.random();

    if (agent.energy < 40 && coffee && r < 0.5) {
      agent.targetX = coffee.x + (Math.random() - 0.5) * 10;
      agent.targetY = coffee.y + (Math.random() - 0.5) * 10;
      agent.state = 'walking';
      return;
    }

    if (meeting && r < 0.15 + (agent.role === 'pm' || agent.role === 'ceo' ? 0.1 : 0)) {
      agent.targetX = meeting.x + (Math.random() - 0.5) * 20;
      agent.targetY = meeting.y + (Math.random() - 0.5) * 10;
      agent.state = 'walking';
      return;
    }

    if (r < 0.25) {
      const others = OFFICE_LOCATIONS().filter(
        (l) => l.id !== location?.id && l.role !== 'coffee' && Math.random() < 0.4,
      );
      if (others.length > 0) {
        const target = others[Math.floor(Math.random() * others.length)];
        agent.targetX = target.x + (Math.random() - 0.5) * 15;
        agent.targetY = target.y + (Math.random() - 0.5) * 10;
        agent.state = 'walking';
        return;
      }
    }

    if (location) {
      agent.targetX = location.x + (Math.random() - 0.5) * 30;
      agent.targetY = location.y + (Math.random() - 0.5) * 15;
      if (Math.random() < 0.3) {
        agent.targetX += (Math.random() - 0.5) * 40;
      }
    }
    agent.state = 'working';
  }

  private drawAgent(agent: Agent): void {
    const g = this.agentGraphics.get(agent.id);
    const label = this.agentLabels.get(agent.id);
    const sprite = this.agentSprites.get(agent.id);
    if (!g || !sprite) return;

    const t = Date.now() * 0.005;
    const isWalking = agent.state === 'walking';
    const bobY = isWalking ? Math.sin(t) * 2.5 : (agent.mood === 'happy' ? Math.sin(t * 0.3) * 0.8 : 0);
    const drawY = Math.round(agent.y + bobY);
    const x = Math.round(agent.x);

    const labelY = agent.y - 45;

    if (label) {
      label.setPosition(x - label.width / 2, labelY);
      label.setDepth(50);
    }

    // Dual-state sprite switching
    const roleKey = agent.role === 'engineer' ? 'engineer' : agent.role;
    const deskKey = `agent_desk_${roleKey}`;
    const walkKey = `agent_walk_${roleKey}`;
    const targetTexture = isWalking && this.textures.exists(walkKey) ? walkKey
      : this.textures.exists(deskKey) ? deskKey
      : 'agent';

    if (sprite.texture.key !== targetTexture) {
      sprite.setTexture(targetTexture);
    }

    sprite.setPosition(x, drawY);
    sprite.setDepth(10);
    sprite.setScale(isWalking ? 0.015 : 0.005);
    sprite.setFlipX(isWalking ? Math.cos(t * 2) < 0 : false);

    g.setPosition(0, 0);
    g.setScale(1, 1);
    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x, drawY + 24, 30, 6);

    // Selection
    const store = useGameStore.getState();
    const isSelected = store.selectedAgentId === agent.id;
    if (isSelected) {
      g.lineStyle(1, 0x6366f1, 0.6);
      g.strokeRect(x - 18, drawY - 24, 36, 56);
      g.fillStyle(agent.color, 0.08);
      g.fillRect(x - 18, drawY - 24, 36, 56);
    }

    // Energy bar
    const energyPercent = agent.energy / 100;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - 12, labelY - 6, 24, 4);
    const energyColor = energyPercent > 0.6 ? 0x22c55e :
      energyPercent > 0.3 ? 0xf59e0b : 0xef4444;
    g.fillStyle(energyColor, 1);
    g.fillRect(x - 11, labelY - 5, 22 * energyPercent, 2);
  }

  private updateBubble(agent: Agent): void {
    const bubble = this.agentBubbles.get(agent.id);
    if (!bubble) return;

    const lastMsg = agent.conversations[agent.conversations.length - 1];
    const isTalking = lastMsg && lastMsg.fromAgentId === agent.id && (Date.now() - lastMsg.timestamp) < 5000;
    if (!isTalking) {
      bubble.setVisible(false);
      return;
    }

    const text = lastMsg.message.length > 25
      ? lastMsg.message.slice(0, 25) + '...'
      : lastMsg.message;

    const bubbleText = bubble.getAt(1) as Phaser.GameObjects.Text;
    bubbleText.setText(`"${text}"`);

    const padding = 6;
    const bw = bubbleText.width + padding * 2;
    const bh = bubbleText.height + padding * 2;
    const bx = agent.x - bw / 2;
    const by = agent.y - 60 - bh;

    const bg = bubble.getAt(0) as Phaser.GameObjects.Graphics;
    bg.clear();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(bx, by, bw, bh, 4);
    bg.lineStyle(1, 0xffffff, 0.3);
    bg.strokeRoundedRect(bx, by, bw, bh, 4);

    bubble.setPosition(bx + bw / 2, by + bh / 2);
    bubble.setVisible(true);
    bubble.setAlpha(isTalking ? 1 : 0);
  }

  private drawOffice(): void {
    const g = this.officeGraphics;
    g.clear();
    const W = CANVAS.width;
    const H = CANVAS.height;

    // Background
    g.fillStyle(0x0a0a1e, 1);
    g.fillRect(0, 0, W, H);

    // Tile grid
    for (let x = 0; x < W; x += 2) {
      for (let y = 0; y < H; y += 2) {
        g.fillStyle((x + y) % 4 === 0 ? 0x0c0c20 : 0x0a0a1e, 0.5);
        g.fillRect(x * 4, y * 4, 8, 8);
      }
    }

    // Draw all zone floors
    for (const zone of ZONES) {
      g.fillStyle(zone.floorColor, 1);
      g.fillRect(zone.x, zone.y, zone.width, zone.height);

      // Subtle tile pattern
      for (let tx = zone.x; tx < zone.x + zone.width; tx += 16) {
        for (let ty = zone.y; ty < zone.y + zone.height; ty += 16) {
          g.fillStyle(zone.floorColor + 0x040404, 0.3);
          g.fillRect(tx, ty, 15, 15);
        }
      }
    }

    // Walls
    g.lineStyle(3, 0x2d2d5e, 1);
    // Outer border
    g.strokeRect(1, 1, W - 2, H - 2);
    // Zone dividers
    g.lineStyle(2, 0x2a2a5e, 1);
    // Left column dividers
    g.lineBetween(0, 155, 170, 155);
    g.lineBetween(0, 290, 170, 290);
    g.lineBetween(170, 0, 170, H);
    // Right column dividers
    g.lineBetween(480, 0, 480, H);
    g.lineBetween(480, 135, W, 135);
    g.lineBetween(480, 305, W, 305);
    // Center horizontal
    g.lineBetween(175, 340, 475, 340);

    // === CEO OFFICE (top-left) ===
    this.drawCEOFurniture(g);

    // === HR DESK (middle-left) ===
    this.drawHRFurniture(g);

    // === KITCHEN / COFFEE ZONE (bottom-left) ===
    this.drawKitchenFurniture(g);

    // === DEVELOPMENT & PM AREA (center) ===
    this.drawDevHubFurniture(g);

    // === PM DESK (bottom-center) ===
    this.drawPMFurniture(g);

    // === DATABASE ZONE (top-right) ===
    this.drawDatabaseFurniture(g);

    // === RESEARCHER AREA (middle-right) ===
    this.drawResearcherFurniture(g);

    // === GAMING ZONE (bottom-right) ===
    this.drawGamingFurniture(g);

    // === ENTRANCE (bottom-center) ===
    this.drawEntrance(g);

    // === LEGEND (bottom-left corner) ===
    this.drawLegend(g);
  }

  private drawCEOFurniture(g: Phaser.GameObjects.Graphics): void {
    // Executive desk
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(50, 60, 70, 45);
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(54, 64, 62, 37);
    // Monitor
    g.fillStyle(0x0a0a1a, 1);
    g.fillRect(65, 45, 40, 28);
    g.fillStyle(0x00f5ff, 0.08);
    g.fillRect(67, 47, 36, 24);
    // Chair
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(70, 110, 30, 20);
    // Bookshelf (left wall)
    g.fillStyle(0x2a1a10, 1);
    g.fillRect(8, 10, 20, 130);
    g.fillStyle(0x3a2a1a, 1);
    for (let i = 0; i < 5; i++) {
      g.fillRect(10, 15 + i * 25, 16, 20);
    }
    // Guest chairs
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(30, 70, 14, 14);
    g.fillRect(30, 100, 14, 14);
    // Plant
    this.drawPlant(g, 150, 15);
    // Label
    g.fillStyle(0x00f5ff, 0.3);
    g.fillRect(55, 135, 60, 1);
  }

  private drawHRFurniture(g: Phaser.GameObjects.Graphics): void {
    // HR desk
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(50, 195, 70, 40);
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(54, 199, 62, 32);
    // Monitor
    g.fillStyle(0x0a0a1a, 1);
    g.fillRect(65, 180, 35, 25);
    g.fillStyle(0xf472b6, 0.1);
    g.fillRect(67, 182, 31, 21);
    // Chair
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(70, 240, 25, 16);
    // Plant
    this.drawPlant(g, 150, 175);
  }

  private drawKitchenFurniture(g: Phaser.GameObjects.Graphics): void {
    // Coffee machine
    g.fillStyle(0x2a1a1a, 1);
    g.fillRect(20, 310, 50, 40);
    g.fillStyle(0x3a2a2a, 1);
    g.fillRect(24, 314, 42, 32);
    g.fillStyle(0x6a4a2a, 1);
    g.fillRect(30, 320, 8, 10);
    g.fillRect(45, 320, 8, 10);
    // Round table
    g.fillStyle(0x3a2a1a, 1);
    g.fillCircle(100, 400, 30);
    g.fillStyle(0x4a3a2a, 1);
    g.fillCircle(100, 400, 25);
    // Chairs around table
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(65, 400, 8);
    g.fillCircle(135, 400, 8);
    g.fillCircle(100, 365, 8);
    g.fillCircle(100, 435, 8);
    // Fridge
    g.fillStyle(0x2a2a3a, 1);
    g.fillRect(140, 300, 25, 45);
    g.fillStyle(0x3a3a4a, 1);
    g.fillRect(142, 302, 21, 20);
    g.fillRect(142, 324, 21, 19);
  }

  private drawDevHubFurniture(g: Phaser.GameObjects.Graphics): void {
    // Top dev cluster (2x2 desks)
    const clusterPositions = [
      { x: 210, y: 50 }, { x: 310, y: 50 },
      { x: 210, y: 140 }, { x: 310, y: 140 },
    ];
    for (const pos of clusterPositions) {
      this.drawDeskCluster(g, pos.x, pos.y);
    }

    // Bottom dev cluster (2x2 desks)
    const cluster2Positions = [
      { x: 210, y: 220 }, { x: 310, y: 220 },
      { x: 210, y: 290 }, { x: 310, y: 290 },
    ];
    for (const pos of cluster2Positions) {
      this.drawDeskCluster(g, pos.x, pos.y);
    }

    // "FOCUS > PLAN > EXECUTE" poster
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(340, 10, 60, 50);
    g.lineStyle(1, 0x00f5ff, 0.3);
    g.strokeRect(340, 10, 60, 50);
    g.fillStyle(0x00f5ff, 0.5);
    g.fillRect(348, 18, 44, 1);
    g.fillRect(348, 30, 44, 1);
    g.fillRect(348, 42, 44, 1);

    // Plants
    this.drawPlant(g, 190, 55);
    this.drawPlant(g, 460, 55);
    this.drawPlant(g, 190, 225);
    this.drawPlant(g, 460, 225);
  }

  private drawDeskCluster(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Desk
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x, y, 75, 55);
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(x + 3, y + 3, 69, 49);
    // Monitor
    g.fillStyle(0x0a0a1a, 1);
    g.fillRect(x + 20, y - 12, 35, 22);
    g.fillStyle(0x00f5ff, 0.06);
    g.fillRect(x + 22, y - 10, 31, 18);
    // Chair
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(x + 25, y + 58, 25, 14);
  }

  private drawPMFurniture(g: Phaser.GameObjects.Graphics): void {
    // PM desk
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(290, 385, 80, 45);
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(294, 389, 72, 37);
    // Monitor
    g.fillStyle(0x0a0a1a, 1);
    g.fillRect(310, 370, 40, 28);
    g.fillStyle(0x4ecdc4, 0.1);
    g.fillRect(312, 372, 36, 24);
    // Chair
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(315, 433, 28, 16);
  }

  private drawDatabaseFurniture(g: Phaser.GameObjects.Graphics): void {
    // Server racks
    for (let i = 0; i < 4; i++) {
      const rx = 500 + i * 55;
      g.fillStyle(0x0a0a1a, 1);
      g.fillRect(rx, 15, 45, 100);
      g.fillStyle(0x1a1a2e, 1);
      g.fillRect(rx + 3, 18, 39, 94);
      // LEDs
      for (let j = 0; j < 6; j++) {
        g.fillStyle(Math.random() > 0.3 ? 0x00ff88 : 0x003322, 1);
        g.fillRect(rx + 35, 22 + j * 14, 4, 4);
        g.fillStyle(Math.random() > 0.3 ? 0xff4444 : 0x332222, 1);
        g.fillRect(rx + 8, 22 + j * 14, 4, 4);
      }
    }
    // Whiteboard
    g.fillStyle(0x2a2a3a, 1);
    g.fillRect(500, 100, 80, 25);
    g.lineStyle(1, 0x00f5ff, 0.3);
    g.strokeRect(500, 100, 80, 25);
  }

  private drawResearcherFurniture(g: Phaser.GameObjects.Graphics): void {
    // Long desk with 4 workstations
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(500, 180, 200, 50);
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(504, 184, 192, 42);
    // Monitors
    for (let i = 0; i < 4; i++) {
      const mx = 515 + i * 48;
      g.fillStyle(0x0a0a1a, 1);
      g.fillRect(mx, 165, 30, 20);
      g.fillStyle(0x45b7d1, 0.1);
      g.fillRect(mx + 2, 167, 26, 16);
    }
    // Bookshelf
    g.fillStyle(0x2a1a10, 1);
    g.fillRect(700, 150, 18, 100);
    g.fillStyle(0x3a2a1a, 1);
    for (let i = 0; i < 4; i++) {
      g.fillRect(702, 155 + i * 24, 14, 18);
    }
    // Plant
    this.drawPlant(g, 490, 195);
  }

  private drawGamingFurniture(g: Phaser.GameObjects.Graphics): void {
    // Large TV
    g.fillStyle(0x0a0a1a, 1);
    g.fillRect(530, 330, 120, 70);
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(534, 334, 112, 62);
    // TV screen glow
    g.fillStyle(0x00f5ff, 0.08);
    g.fillRect(538, 338, 104, 54);
    // "GAME ON" neon sign
    g.fillStyle(0xff0055, 0.6);
    g.fillRect(510, 335, 15, 20);
    g.fillStyle(0x00f5ff, 0.6);
    g.fillRect(655, 335, 15, 20);
    // Beanbags
    g.fillStyle(0x4a2040, 1);
    g.fillCircle(540, 430, 18);
    g.fillStyle(0x2a4060, 1);
    g.fillCircle(600, 440, 18);
    g.fillStyle(0x6a2030, 1);
    g.fillCircle(660, 430, 18);
    // Console table
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(560, 410, 60, 15);
  }

  private drawEntrance(g: Phaser.GameObjects.Graphics): void {
    // Welcome mat
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(320, 455, 80, 20);
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(324, 459, 72, 12);
    // Glass doors
    g.lineStyle(2, 0x00f5ff, 0.3);
    g.strokeRect(315, 445, 90, 30);
    g.lineBetween(360, 445, 360, 475);
    // Plants flanking
    this.drawPlant(g, 300, 450);
    this.drawPlant(g, 410, 450);
  }

  private drawLegend(g: Phaser.GameObjects.Graphics): void {
    const W = CANVAS.width;
    const H = CANVAS.height;
    const lx = 10;
    const ly = H - 80;

    g.fillStyle(0x0a0a1e, 0.85);
    g.fillRect(lx, ly, 160, 75);
    g.lineStyle(1, 0x2d2d5e, 0.5);
    g.strokeRect(lx, ly, 160, 75);

    const items = [
      { color: 0x1e1828, label: 'CEO Office' },
      { color: 0x1e1a14, label: 'HR Desk' },
      { color: 0x141a28, label: 'Database' },
      { color: 0x141a18, label: 'Researcher' },
      { color: 0x1a1a22, label: 'Dev & PM' },
      { color: 0x1a1428, label: 'Gaming' },
      { color: 0x1a1410, label: 'Kitchen' },
    ];

    items.forEach((item, i) => {
      const iy = ly + 8 + i * 10;
      g.fillStyle(item.color, 1);
      g.fillRect(lx + 6, iy, 8, 8);
      g.lineStyle(1, 0x2d2d5e, 0.3);
      g.strokeRect(lx + 6, iy, 8, 8);
    });
  }

  private drawPlant(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0x1a3a1a, 1);
    g.fillRect(x, y + 8, 12, 14);
    g.fillStyle(0x2a5a2a, 1);
    g.fillRect(x + 2, y, 8, 12);
    g.fillStyle(0x3a7a3a, 1);
    g.fillRect(x + 4, y - 2, 4, 6);
  }
}
