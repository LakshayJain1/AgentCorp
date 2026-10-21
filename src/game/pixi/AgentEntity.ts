import { Agent, AgentWorkStatus, AgentFSMState, AgentMood } from '@/agents/AgentTypes';
import { Sprite, Container, Graphics, Text, TextStyle, Texture, ColorSource } from 'pixi.js';
import { Application } from 'pixi.js';
import { CANVAS, WALKABLE_Y_MIN, findLocationByRole, findLocationById, isWallBetween, toOfficeLocations } from './PixiOfficeLayout';
import { useGameStore } from '@/store/gameStore';

export interface AgentEntityData {
  id: string;
  name: string;
  role: Agent['role'];
  color: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: 'idle' | 'walking' | 'working' | 'resting' | 'communicating';
  energy: number;
  maxEnergy: number;
  mood: AgentMood;
  workStatus: AgentWorkStatus;
  fsmState: AgentFSMState;
  efficiency: number;
  online: boolean;
  cooldownRemainingSeconds?: number;
  cooldownType?: string;
  cooldownTargetLocId?: string;
  lastGoalTime?: number;
  conversations: Array<{ fromAgentId: string; message: string; timestamp: number }>;
}

export class AgentEntity {
  public readonly id: string;
  public name: string;
  public readonly role: Agent['role'];
  public readonly color: number;
  public readonly container: Container;
  
  // Sliced frame textures (each element is one 16×16 frame)
  private walkFrames: Texture[] = [];
  private idleFrames: Texture[] = [];
  private walkFrame = 0;
  private idleFrame = 0;
  private lastFrameUpdate = 0;

  private currentSprite: Sprite | null = null;
  
  private label: Text;
  private bubbleContainer: Container;
  private bubbleText: Text;
  private bubbleBg: Graphics;
  private shadow: Graphics;
  private selectionGraphics: Graphics;
  private energyBarBg: Graphics;
  private energyBarFill: Graphics;
  
  // State
  public x: number;
  public y: number;
  public targetX: number;
  public targetY: number;
  public state: AgentEntityData['state'] = 'idle';
  public energy: number;
  public maxEnergy: number;
  public mood: AgentMood = 'neutral';
  public workStatus: AgentWorkStatus = 'idle';
  public fsmState: AgentFSMState = 'idle';
  public efficiency: number;
  public online: boolean;
  public cooldownRemainingSeconds?: number;
  public cooldownType?: string;
  public cooldownTargetLocId?: string;
  public lastGoalTime?: number;
  public conversations: AgentEntityData['conversations'] = [];
  
  // Performance for UI
  public performance: { tasksCompleted: number; tasksFailed: number; successRate: number } = {
    tasksCompleted: 0,
    tasksFailed: 0,
    successRate: 1,
  };
  
  private isSelected = false;

  constructor(data: AgentEntityData, _app: Application) {
    this.id = data.id;
    this.name = data.name;
    this.role = data.role;
    this.color = data.color;
    this.x = data.x;
    this.y = data.y;
    this.targetX = data.targetX;
    this.targetY = data.targetY;
    this.state = data.state;
    this.energy = data.energy;
    this.maxEnergy = data.maxEnergy;
    this.mood = data.mood;
    this.workStatus = data.workStatus;
    this.fsmState = data.fsmState;
    this.efficiency = data.efficiency;
    this.online = data.online;
    this.cooldownRemainingSeconds = data.cooldownRemainingSeconds;
    this.cooldownType = data.cooldownType;
    this.cooldownTargetLocId = data.cooldownTargetLocId;
    this.lastGoalTime = data.lastGoalTime;
    this.conversations = data.conversations;

    this.container = new Container();
    this.container.zIndex = 10;
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    // Shadow — dynamic: shrinks when agent bobs up, grows when grounded
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 5, 16, 5);
    this.shadow.fill({ color: 0x000000, alpha: 0.38 });
    this.container.addChild(this.shadow);

    // Label
    const labelStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fill: 0xffffff,
      padding: 4,
    });
    this.label = new Text({ text: this.name, style: labelStyle });
    this.label.anchor.x = 0.5;
    this.label.anchor.y = 1;
    this.label.zIndex = 50;
    this.container.addChild(this.label);

    // Energy bar — sits just above head (head at y=-32 for scale-2 sprite)
    this.energyBarBg = new Graphics();
    this.energyBarBg.rect(-12, -36, 24, 3);
    this.energyBarBg.fill(0x000000, 0.6);
    this.container.addChild(this.energyBarBg);

    this.energyBarFill = new Graphics();
    this.container.addChild(this.energyBarFill);
    this.updateEnergyBar();

    // Speech bubble
    this.bubbleContainer = new Container();
    this.bubbleContainer.visible = false;
    this.bubbleContainer.zIndex = 60;

    this.bubbleBg = new Graphics();
    this.bubbleText = new Text({ 
      text: '', 
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: 0xffffff, wordWrap: true, wordWrapWidth: 100 })
    });
    this.bubbleText.anchor.x = 0.5;
    this.bubbleText.anchor.y = 0.5;
    this.bubbleContainer.addChild(this.bubbleBg, this.bubbleText);
    this.container.addChild(this.bubbleContainer);

    // Selection graphics
    this.selectionGraphics = new Graphics();
    this.selectionGraphics.zIndex = 5;
    this.container.addChild(this.selectionGraphics);

    // Click handler
    this.container.on('pointerdown', () => {
      const store = useGameStore.getState();
      store.setSelectedAgent(this.id);
    });
  }

  setSpriteCache(cache: { walkFrames: Texture[]; idleFrames: Texture[] }): void {
    this.walkFrames = cache.walkFrames;
    this.idleFrames = cache.idleFrames;
    this.walkFrame = 0;
    this.idleFrame = 0;
    this.lastFrameUpdate = 0;
  }

  update(dt: number, speed: number): void {
    if (!this.online) return;

    this.updateCooldown(dt, speed);
    this.updateMovement(dt, speed);
    this.updateEnergy(dt, speed);
    this.updateVisuals(dt);
    this.updateBubble();
  }

  private updateCooldown(dt: number, speed: number): void {
    const store = useGameStore.getState();
    
    if (this.cooldownRemainingSeconds !== undefined && this.cooldownRemainingSeconds > 0) {
      const elapsedSec = (dt / 1000) * speed;
      this.cooldownRemainingSeconds = Math.max(0, this.cooldownRemainingSeconds - elapsedSec);
      this.workStatus = 'waiting';

      if (this.cooldownType === 'onboarding') {
        this.mood = 'neutral';
        const target = findLocationByRole('gaming') || findLocationByRole('coffee');
        if (target) this.moveTowards(target.x, target.y, 25);
      } else if (this.cooldownType === 'burnout') {
        this.mood = 'happy';
        if (!this.cooldownTargetLocId) {
          const gaming = findLocationByRole('gaming');
          const coffee = findLocationByRole('coffee');
          const target = Math.random() < 0.5 ? gaming : coffee;
          this.cooldownTargetLocId = target?.id || 'gaming_zone';
        }
        const targetLoc = findLocationById(this.cooldownTargetLocId);
        if (targetLoc) this.moveTowards(targetLoc.x, targetLoc.y, 15);
      }

      if (this.cooldownRemainingSeconds === 0) {
        this.completeCooldown(store);
      }
      return;
    }
  }

  private completeCooldown(store: ReturnType<typeof useGameStore.getState>): void {
    if (this.cooldownType === 'onboarding') {
      const finalName = this.name.replace('Onboarding: ', '');
      this.name = finalName;
      this.label.text = finalName;
      this.online = true;
      this.efficiency = 100;
      this.energy = 100;
      this.mood = 'happy';
      this.workStatus = 'idle';
      this.fsmState = 'idle';
      this.updatePerformance();
      
      store.addEvent({
        id: `onboard_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: 'agent',
        message: `🎉 Onboarded new ${this.role} agent: ${this.name}! All metrics reset to 100% efficiency.`,
        agentId: this.id,
        taskId: null,
      });
    } else if (this.cooldownType === 'burnout') {
      this.energy = 100;
      this.efficiency = 100;
      this.mood = 'focused';
      this.workStatus = 'idle';
      this.fsmState = 'idle';

      store.addEvent({
        id: `cooldown_done_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: 'agent',
        message: `⚡ ${this.name} is back from cooldown at 100% efficiency!`,
        agentId: this.id,
        taskId: null,
      });
    }

    this.cooldownType = undefined;
    this.cooldownTargetLocId = undefined;
    this.cooldownRemainingSeconds = undefined;

    const location = findLocationByRole(this.role);
    if (location) {
      this.targetX = location.x;
      this.targetY = location.y;
      this.state = 'walking';
    }
  }

  private updatePerformance(): void {
    // Performance will be updated via store
  }

  private updateMovement(dt: number, speed: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const moveSpeed = 1.2 * (dt / 16) * speed;

    if (dist > 0.5) {
      this.x += (dx / dist) * moveSpeed;
      this.y += (dy / dist) * moveSpeed;
      this.state = 'walking';
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
      if (this.state === 'walking') this.state = 'working';
    }

    this.y = Math.max(WALKABLE_Y_MIN, this.y);

    // Check for new goal
    const distToTarget = Math.sqrt(
      (this.x - this.targetX) ** 2 + (this.y - this.targetY) ** 2
    );

    if (distToTarget < 3 && (this.state === 'idle' || this.state === 'working' || this.state === 'resting')) {
      if (!this.lastGoalTime || (Date.now() - this.lastGoalTime) > 2000) {
        this.pickNextGoal();
        this.lastGoalTime = Date.now();
      }
    }
  }

  private moveTowards(targetX: number, targetY: number, threshold: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > threshold && this.state !== 'walking') {
      this.targetX = targetX + (Math.random() - 0.5) * 15;
      this.targetY = Math.max(WALKABLE_Y_MIN, targetY + (Math.random() - 0.5) * 15);
      this.state = 'walking';
    } else if (dist <= threshold && this.state !== 'walking') {
      this.state = 'resting';
    }
  }

  private pickNextGoal(): void {
    const location = findLocationByRole(this.role);
    const meeting = findLocationByRole('meeting');
    const coffee = findLocationByRole('coffee');

    const clampY = (ty: number) => Math.max(WALKABLE_Y_MIN, ty);
    const isValidTarget = (tx: number, ty: number) => !isWallBetween(this.x, this.y, tx, ty);

    const r = Math.random();

    // 1. Need coffee (low energy)
    if (this.energy < 40 && coffee && r < 0.5) {
      const tx = coffee.x + (Math.random() - 0.5) * 10;
      const ty = clampY(coffee.y + (Math.random() - 0.5) * 10);
      if (isValidTarget(tx, ty)) {
        this.targetX = tx;
        this.targetY = ty;
        this.state = 'walking';
        return;
      }
    }

    // 2. Go to meeting
    if (meeting && r < 0.15 + (this.role === 'pm' || this.role === 'ceo' ? 0.1 : 0)) {
      const tx = meeting.x + (Math.random() - 0.5) * 20;
      const ty = clampY(meeting.y + (Math.random() - 0.5) * 10);
      if (isValidTarget(tx, ty)) {
        this.targetX = tx;
        this.targetY = ty;
        this.state = 'walking';
        return;
      }
    }

    // 3. Visit another department
    if (r < 0.2) {
      const locations = toOfficeLocations();
      const others = locations.filter(
        l => l.id !== location?.id && l.role !== 'coffee' && Math.random() < 0.3
      );
      if (others.length > 0) {
        const target = others[Math.floor(Math.random() * others.length)];
        const tx = target.x + (Math.random() - 0.5) * 15;
        const ty = clampY(target.y + (Math.random() - 0.5) * 10);
        if (isValidTarget(tx, ty)) {
          this.targetX = tx;
          this.targetY = ty;
          this.state = 'walking';
          return;
        }
      }
    }

    // 4. Stay near own desk
    if (location) {
      const tx = location.x + (Math.random() - 0.5) * 20;
      const ty = clampY(location.y + (Math.random() - 0.5) * 10);
      if (isValidTarget(tx, ty)) {
        this.targetX = tx;
        this.targetY = ty;
        this.state = 'walking';
        return;
      }
    }

    // Fallback
    this.state = 'working';
  }

  private updateEnergy(dt: number, speed: number): void {
    const store = useGameStore.getState();
    const rate = 0.008 * (dt / 16) * speed;

    if (this.state === 'working' || this.state === 'walking') {
      this.energy -= rate * (this.state === 'walking' ? 1.5 : 2.5);
    }

    if (this.state === 'working' && this.online) {
      this.efficiency = Math.max(10, this.efficiency - rate * 0.4);
    }

    const isWorker = this.role === 'engineer' || this.role === 'qa' || this.role === 'researcher'
      || this.role === 'sales' || this.role === 'finance' || this.role === 'ops';
    if (this.efficiency < 50 && isWorker && !this.cooldownRemainingSeconds && this.online) {
      this.cooldownRemainingSeconds = 180 + Math.random() * 60;
      this.cooldownType = 'burnout';
      this.workStatus = 'waiting';
      this.mood = 'tired';
      this.state = 'resting';

      const coffeeLoc = findLocationByRole('coffee');
      const gamingLoc = findLocationByRole('gaming');
      const target = Math.random() < 0.5 ? gamingLoc : coffeeLoc;
      this.cooldownTargetLocId = target?.id || 'gaming_zone';

      if (target) {
        this.targetX = target.x + (Math.random() - 0.5) * 15;
        this.targetY = target.y + (Math.random() - 0.5) * 15;
        this.state = 'walking';
      }

      store.addEvent({
        id: `burnout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: 'agent',
        message: `💤 ${this.name} (${this.role}) feels fatigued (efficiency: ${Math.round(this.efficiency)}%). Heading to the Coffee/Gaming zone for a break.`,
        agentId: this.id,
        taskId: null,
      });
      return;
    }

    const coffeeLoc = findLocationByRole('coffee');
    if (coffeeLoc) {
      const dist = Math.sqrt(
        (this.x - coffeeLoc.x) ** 2 + (this.y - coffeeLoc.y) ** 2
      );
      if (dist < 15) {
        this.energy = Math.min(100, this.energy + rate * 25);
        this.mood = 'happy';
      }
    }

    this.energy = Math.max(0, Math.min(100, this.energy));
    this.updateEnergyBar();
  }

  private updateEnergyBar(): void {
    const energyPercent = this.energy / 100;
    this.energyBarFill.clear();
    const energyColor = energyPercent > 0.6 ? 0x22c55e : energyPercent > 0.3 ? 0xf59e0b : 0xef4444;
    this.energyBarFill.rect(-11, -35, 22 * energyPercent, 2);
    this.energyBarFill.fill(energyColor);
  }

  updateVisuals(dt: number): void {
    const isWalking = this.state === 'walking';
    const t = Date.now() * 0.005;
    const bobY = isWalking ? Math.sin(t) * 2.5 : (this.mood === 'happy' ? Math.sin(t * 0.3) * 0.8 : 0);
    const drawY = Math.round(this.y + bobY);
    const x = Math.round(this.x);
    // Shadow scale shrinks as agent rises (creates depth illusion)
    const shadowScale = 1 - Math.abs(bobY) / 10;
    this.shadow.scale.set(shadowScale, shadowScale * 0.85);

    // Position container
    this.container.position.x = x;
    this.container.position.y = drawY;

    // Update label position
    this.label.position.x = 0;
    this.label.position.y = -45;

    // Advance animation frame
    this.lastFrameUpdate += dt;
    const walkInterval = 120;  // ms per walk frame  (~8 fps)
    const idleInterval = 300;  // ms per idle frame  (~3 fps)

    if (isWalking && this.walkFrames.length > 0) {
      if (this.lastFrameUpdate >= walkInterval) {
        this.lastFrameUpdate = 0;
        this.walkFrame = (this.walkFrame + 1) % this.walkFrames.length;
      }
      const tex = this.walkFrames[this.walkFrame];
      if (!this.currentSprite) {
        this.currentSprite = new Sprite(tex);
        this.currentSprite.anchor.set(0.5, 1);
        this.currentSprite.tint = this.color as ColorSource;
        this.currentSprite.scale.set(2, 2);
        this.container.addChildAt(this.currentSprite, 1);
      } else {
        this.currentSprite.texture = tex;
      }
      const moveX = this.targetX - this.x;
      this.currentSprite.scale.set(moveX < -0.5 ? -2 : 2, 2);
    } else if (!isWalking && this.idleFrames.length > 0) {
      if (this.lastFrameUpdate >= idleInterval) {
        this.lastFrameUpdate = 0;
        this.idleFrame = (this.idleFrame + 1) % this.idleFrames.length;
      }
      const tex = this.idleFrames[this.idleFrame];
      if (!this.currentSprite) {
        this.currentSprite = new Sprite(tex);
        this.currentSprite.anchor.set(0.5, 1);
        this.currentSprite.tint = this.color as ColorSource;
        this.container.addChildAt(this.currentSprite, 1);
      } else {
        this.currentSprite.texture = tex;
        this.currentSprite.scale.set(2, 2);
      }
    } else {
      // Fallback colored circle when no sprites are loaded
      if (!this.currentSprite) {
        const g = new Graphics();
        g.circle(0, -8, 8);
        g.fill(this.color);
        // Cast Graphics to Container child; store a dummy sprite sentinel
        this.container.addChildAt(g, 1);
      }
    }

    // Selection highlight — wraps the 32px (scale-2) sprite from y=-32 to y=+4
    this.selectionGraphics.clear();
    if (this.isSelected) {
      this.selectionGraphics.rect(-16, -32, 32, 36);
      this.selectionGraphics.stroke({ width: 1, color: 0x6366f1, alpha: 0.6 });
      this.selectionGraphics.rect(-16, -32, 32, 36);
      this.selectionGraphics.fill(this.color, 0.08);
    }
  }

  private updateBubble(): void {
    const lastMsg = this.conversations[this.conversations.length - 1];
    const isTalking = lastMsg && lastMsg.fromAgentId === this.id && (Date.now() - lastMsg.timestamp) < 5000;

    if (!isTalking) {
      this.bubbleContainer.visible = false;
      return;
    }

    const text = lastMsg.message.length > 25
      ? lastMsg.message.slice(0, 25) + '...'
      : lastMsg.message;

    this.bubbleText.text = `"${text}"`;
    this.bubbleText.anchor.x = 0.5;
    this.bubbleText.anchor.y = 0.5;

    const padding = 6;
    const bw = this.bubbleText.width + padding * 2;
    const bh = this.bubbleText.height + padding * 2;
    const bx = -bw / 2;
    const by = -60 - bh;

    this.bubbleBg.clear();
    this.bubbleBg.roundRect(bx, by, bw, bh, 4);
    this.bubbleBg.fill(0x000000, 0.85);
    this.bubbleBg.roundRect(bx, by, bw, bh, 4);
    this.bubbleBg.stroke({ width: 1, color: 0xffffff, alpha: 0.3 });

    this.bubbleContainer.position.x = 0;
    this.bubbleContainer.position.y = 0;
    this.bubbleContainer.visible = true;
    this.bubbleContainer.alpha = 1;
  }

  setSelected(selected: boolean): void {
    this.isSelected = selected;
  }

  updateFromStore(data: Partial<AgentEntityData>): void {
    Object.assign(this, data);
    if (data.name !== undefined) this.label.text = data.name;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}