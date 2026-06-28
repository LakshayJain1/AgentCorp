import Phaser from 'phaser';
import { useGameStore } from '@/store/gameStore';
import { Agent } from '@/agents/AgentTypes';
import { OFFICE_LOCATIONS } from '@/store/gameStore';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';
import { preloadAllConfigs } from '@/config/preload';
import { maybeStartConversation, updateAgentMoods } from '@/systems/ConversationSystem';
import { generateAmbientChatter } from '@/systems/EventSystem';

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
    this.load.image('agent', '/sprites/agent.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0a1e');

    this.officeGraphics = this.add.graphics();
    this.drawOffice();

    const store = useGameStore.getState();
    preloadAllConfigs().then(() => {
      // Configs loaded; future agent creations will use config data
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

      const sprite = this.add.image(agent.x, agent.y, 'agent');
      sprite.setDepth(5);
      sprite.setScale(0.05);
      sprite.setTint(agent.color);
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

    // === ORCHESTRATOR TICK — processes user-created tasks only ===
    if (this.frameCount % Math.max(1, Math.floor(30 / speed)) === 0) {
      if (!this.processing) {
        this.processing = true;
        centralOrchestrator.tick().finally(() => {
          this.processing = false;
        });
      }
    }

    // Legacy ambient systems
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

    // Sync to store at reduced rate (every 6 frames ≈ 10fps) to avoid React thrashing
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

    // ─── COOLDOWN MANAGEMENT ───
    if (agent.cooldownRemainingSeconds !== undefined && agent.cooldownRemainingSeconds > 0) {
      // Decrement cooldown timer in real-world seconds, scaled by speed
      const elapsedSec = (dt / 1000) * speed;
      agent.cooldownRemainingSeconds = Math.max(0, agent.cooldownRemainingSeconds - elapsedSec);

      // Visual state during cooldown
      agent.workStatus = 'waiting';

      if (agent.cooldownType === 'onboarding') {
        agent.mood = 'neutral';
        // Stand/idle at the Gaming Zone or Coffee Machine
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

      // Check if cooldown just finished
      if (agent.cooldownRemainingSeconds === 0) {
        if (agent.cooldownType === 'onboarding') {
          // Onboarding completed!
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
          // Burnout break completed!
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

        // Reset target destination to desk
        const location = OFFICE_LOCATIONS().find((l) => l.role === agent.role);
        if (location) {
          agent.targetX = location.x;
          agent.targetY = location.y;
          agent.state = 'walking';
        }
      }
      return; // Skip normal energy/efficiency logic while cooling down
    }

    // ─── NORMAL ENERGY & EFFICIENCY DRAIN ───
    if (agent.state === 'working' || agent.state === 'walking') {
      agent.energy -= rate * (agent.state === 'walking' ? 1.5 : 2.5);
    }

    if (agent.state === 'working' && agent.online) {
      // Slowly drain efficiency while working
      agent.efficiency = Math.max(10, agent.efficiency - rate * 0.4);
    }

    // Burnout Check: fatigue triggers if efficiency drops below 50
    const isWorker = agent.role === 'engineer' || agent.role === 'qa' || agent.role === 'researcher';
    if (agent.efficiency < 50 && isWorker && !agent.currentSubTaskId && agent.online) {
      // Trigger burnout cooldown
      agent.cooldownRemainingSeconds = 180 + Math.random() * 60; // 3-4 minutes
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
      // At destination - decide what to do next
      this.pickNextGoal(agent);
    }
  }

  private pickNextGoal(agent: Agent): void {
    const store = useGameStore.getState();
    const location = OFFICE_LOCATIONS().find((l) => l.role === agent.role);
    const meeting = OFFICE_LOCATIONS().find((l) => l.role === 'meeting');
    const coffee = OFFICE_LOCATIONS().find((l) => l.role === 'coffee');

    // Pick a random action based on conditions
    const r = Math.random();

    // Low energy → go to coffee
    if (agent.energy < 40 && coffee && r < 0.5) {
      agent.targetX = coffee.x + (Math.random() - 0.5) * 10;
      agent.targetY = coffee.y + (Math.random() - 0.5) * 10;
      agent.state = 'walking';
      return;
    }

    // Go to meeting room sometimes
    if (meeting && r < 0.15 + (agent.role === 'pm' || agent.role === 'ceo' ? 0.1 : 0)) {
      agent.targetX = meeting.x + (Math.random() - 0.5) * 20;
      agent.targetY = meeting.y + (Math.random() - 0.5) * 10;
      agent.state = 'walking';
      return;
    }

    // Visit a random location
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

    // Wander near current workstation
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

    const labelY = agent.y - 40;

    // Update label
    if (label) {
      label.setPosition(x - label.width / 2, labelY);
      label.setDepth(50);
    }

    // Update sprite
    sprite.setPosition(x, drawY);
    sprite.setDepth(10);
    sprite.setTint(agent.color);
    sprite.setFlipX(isWalking ? Math.cos(t * 2) < 0 : false);

    // Draw overlay: shadow, selection, energy bar
    g.setPosition(0, 0);
    g.setScale(1, 1);
    g.clear();

    const US = 2;

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

    // Health bar — below name tag, above character
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

    const W = 560, H = 400;

    // Floor
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(0, 0, W, H);

    for (let x = 0; x < 140; x += 2) {
      for (let y = 0; y < 100; y += 2) {
        g.fillStyle((x + y) % 4 === 0 ? 0x16162e : 0x1a1a2e, 0.5);
        g.fillRect(x * 4, y * 4, 8, 8);
      }
    }

    // Outer walls
    g.lineStyle(2, 0x2d2d5e, 1);
    g.strokeRect(2, 2, W - 4, H - 4);

    // Inner walls
    g.lineStyle(2, 0x2a2a5e, 1);
    g.lineBetween(0, 170, W, 170);
    g.lineBetween(140, 0, 140, 170);
    g.lineBetween(225, 0, 225, 170);

    // CEO Office
    g.fillStyle(0x1e1e36, 1);
    g.fillRect(8, 8, 130, 160);
    g.fillStyle(0x2a1a3e, 1);
    g.fillRect(40, 50, 50, 30);
    g.fillStyle(0x3a2a4e, 1);
    g.fillRect(44, 54, 42, 22);
    g.fillStyle(0x0a0a1a, 1);
    g.fillRect(46, 30, 34, 22);
    g.fillStyle(0xffd700, 1);
    g.fillRect(110, 14, 8, 16);

    // PM Desk
    this.drawDesk(g, 240, 85);
    this.drawMonitor(g, 248, 70, 0x4ecdc4);

    // Meeting Room
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(230, 185, 170, 60);
    g.lineStyle(2, 0x4ecdc4, 0.5);
    g.strokeRect(230, 185, 170, 60);
    g.fillStyle(0x22223a, 1);
    g.fillRect(270, 200, 90, 30);
    g.fillStyle(0x2a2a4a, 1);
    g.fillRect(274, 204, 82, 22);
    g.fillStyle(0x3a2a3e, 1);
    g.fillRect(245, 200, 14, 8);
    g.fillRect(370, 200, 14, 8);
    g.fillRect(245, 222, 14, 8);
    g.fillRect(370, 222, 14, 8);

    // Server Rack
    g.fillStyle(0x12122a, 1);
    g.fillRect(10, 210, 120, 135);
    g.lineStyle(1, 0x45b7d1, 0.4);
    g.strokeRect(10, 210, 120, 135);
    for (let i = 0; i < 5; i++) {
      const sy = 218 + i * 24;
      g.fillStyle(0x0a0a1a, 1);
      g.fillRect(18, sy, 104, 18);
      g.fillStyle(0x1a1a2e, 1);
      g.fillRect(22, sy + 2, 96, 14);
      g.fillStyle(Math.random() > 0.3 ? 0x00ff88 : 0x003322, 1);
      g.fillRect(104, sy + 5, 4, 4);
      g.fillStyle(Math.random() > 0.3 ? 0xff4444 : 0x332222, 1);
      g.fillRect(112, sy + 5, 4, 4);
    }

    // Engineer Desk
    this.drawDesk(g, 240, 270);
    this.drawMonitor(g, 248, 255, 0xf9ca24);

    // QA Desk
    this.drawDesk(g, 400, 270);
    this.drawMonitor(g, 408, 255, 0xa29bfe);

    // HR Desk
    this.drawDesk(g, 400, 60);
    g.fillStyle(0xf472b6, 0.6);
    g.fillRect(405, 55, 12, 5);
    this.drawMonitor(g, 408, 45, 0xf472b6);

    // Coffee Machine
    g.fillStyle(0x2a1a1a, 1);
    g.fillRect(430, 70, 45, 55);
    g.fillStyle(0x3a2a2a, 1);
    g.fillRect(434, 74, 37, 47);
    g.fillStyle(0x4a3a3a, 1);
    g.fillRect(438, 84, 6, 8);
    g.fillRect(450, 84, 6, 8);
    g.fillRect(444, 96, 6, 8);

    // Plants
    g.fillStyle(0x1a3a1a, 1);
    g.fillRect(195, 190, 14, 22);
    g.fillStyle(0x2a5a2a, 1);
    g.fillRect(198, 184, 8, 12);
    g.fillStyle(0x1a3a1a, 1);
    g.fillRect(420, 190, 14, 22);
    g.fillStyle(0x2a5a2a, 1);
    g.fillRect(423, 184, 8, 12);

    // Gaming Zone Arcades and Sofa
    // Arcade Cabinet
    g.fillStyle(0x0f172a, 1);
    g.fillRect(150, 310, 22, 34);
    g.fillStyle(0x1e293b, 1);
    g.fillRect(152, 312, 18, 30);
    g.fillStyle(0x00f5ff, 0.45); // screen
    g.fillRect(154, 315, 14, 11);
    g.fillStyle(0xff0055, 1); // controls
    g.fillRect(157, 328, 2, 2);
    g.fillStyle(0x00ff88, 1);
    g.fillRect(163, 328, 2, 2);

    // Gaming Sofa
    g.fillStyle(0x312e81, 1); // Sofa frame
    g.fillRect(185, 325, 36, 20);
    g.fillStyle(0x4338ca, 1); // Sofa cushions
    g.fillRect(188, 328, 30, 14);

    // Window
    g.fillStyle(0x0a0a2e, 1);
    g.fillRect(440, 8, 65, 55);
    g.lineStyle(1, 0x00f5ff, 0.35);
    g.strokeRect(440, 8, 65, 55);
    g.fillStyle(0x1a1a3e, 1);
    for (let i = 0; i < 5; i++) {
      const wx = 448 + i * 12;
      const wh = 12 + Math.random() * 20;
      g.fillRect(wx, 63 - wh + 8, 8, wh);
    }
    g.fillStyle(0xffffff, 0.7);
    for (let i = 0; i < 8; i++) {
      const px = 448 + Math.random() * 48;
      const py = 12 + Math.random() * 32;
      g.fillRect(px, py, 1, 1);
    }

    // Path markings
    g.lineStyle(1, 0x00f5ff, 0.04);
    g.lineBetween(140, 170, 230, 170);
    g.lineBetween(140, 170, 140, 210);
    g.lineBetween(225, 0, 225, 170);
    g.lineBetween(320, 185, 430, 125);
  }

  private drawDesk(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0x2a2a4a, 1);
    g.fillRect(x, y, 55, 42);
    g.fillStyle(0x3a3a5a, 1);
    g.fillRect(x + 3, y + 3, 49, 36);
    g.lineStyle(1, 0x00f5ff, 0.08);
    g.strokeRect(x, y, 55, 42);
  }

  private drawMonitor(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    glowColor: number,
  ): void {
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(x + 2, y + 28, 8, 8);
    g.fillRect(x + 2, y + 36, 38, 4);
    g.fillStyle(0x0a0a1a, 1);
    g.fillRect(x, y, 38, 28);
    g.fillStyle(glowColor, 0.05);
    g.fillRect(x + 2, y + 2, 34, 24);
  }
}
