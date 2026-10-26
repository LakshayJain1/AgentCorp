import { Application, Container, Texture, Rectangle, Assets } from 'pixi.js';
import { useGameStore } from '@/store/gameStore';
import { Agent } from '@/agents/AgentTypes';
import { AgentEntity, AgentEntityData } from './AgentEntity';
import { CANVAS, toOfficeLocations, findLocationByRole } from './PixiOfficeLayout';

const ROLE_COLORS: Record<string, number> = {
  ceo: 0xff6b6b,
  pm: 0x4ecdc4,
  researcher: 0x45b7d1,
  engineer: 0xf9ca24,
  qa: 0xa29bfe,
  hr: 0xf472b6,
  sales: 0xff9f43,
  finance: 0x26de81,
  ops: 0x4b7bec,
};

// All roles share the same sprite sheets from the CEO folder
// These are 64x16 PNGs with 4 frames horizontally (16x16 each)
const SHARED_SPRITE_PATH = '/sprites/agents/ceo';
const WALK_SHEET = 'ceo-walk-right.png';
const IDLE_SHEET = 'ceo-idle-point-right.png';
const FRAME_W = 16;

export class AgentManager {
  private app: Application;
  private agentsContainer: Container;
  private agents: Map<string, AgentEntity> = new Map();
  private walkFrames: Texture[] = [];
  private idleFrames: Texture[] = [];
  private spritesLoaded = false;

  constructor(app: Application) {
    this.app = app;
    this.agentsContainer = new Container();
    this.agentsContainer.zIndex = 10;
    const initialScale = Math.min((app.screen.width || CANVAS.width) / CANVAS.width, (app.screen.height || CANVAS.height) / CANVAS.height);
    this.agentsContainer.scale.set(initialScale);
    this.app.stage.addChild(this.agentsContainer);
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const scale = Math.min(width / CANVAS.width, height / CANVAS.height);
    this.agentsContainer.scale.set(scale);
  }

  async loadSprites(): Promise<void> {
    if (this.spritesLoaded) return;

    const [walkTex, idleTex] = await Promise.all([
      Assets.load(`${SHARED_SPRITE_PATH}/${WALK_SHEET}`),
      Assets.load(`${SHARED_SPRITE_PATH}/${IDLE_SHEET}`),
    ]);

    const sliceSheet = (tex: Texture): Texture[] => {
      const frameCount = Math.floor(tex.width / FRAME_W);
      const frames: Texture[] = [];
      for (let i = 0; i < frameCount; i++) {
        frames.push(new Texture({
          source: tex.source,
          frame: new Rectangle(i * FRAME_W, 0, FRAME_W, tex.height),
        }));
      }
      return frames;
    };

    this.walkFrames = sliceSheet(walkTex);
    this.idleFrames = sliceSheet(idleTex);
    this.spritesLoaded = true;
    console.log('[AgentManager] Sprites loaded —', this.walkFrames.length, 'walk frames,', this.idleFrames.length, 'idle frames');
  }

  createAgents(agentData: Agent[]): void {
    // Clear existing
    this.agents.forEach(a => a.destroy());
    this.agents.clear();
    this.agentsContainer.removeChildren();

    for (const agent of agentData) {
      const location = findLocationByRole(agent.role);
      const startX = location?.x ?? agent.x ?? CANVAS.width / 2;
      const startY = location?.y ?? agent.y ?? CANVAS.height / 2;

      const entityData: AgentEntityData = {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        color: agent.color ?? ROLE_COLORS[agent.role] ?? 0xffffff,
        x: startX,
        y: startY,
        targetX: agent.targetX ?? startX,
        targetY: agent.targetY ?? startY,
        state: agent.state as AgentEntityData['state'],
        energy: agent.energy,
        maxEnergy: agent.maxEnergy,
        mood: agent.mood,
        workStatus: agent.workStatus,
        fsmState: agent.fsmState,
        efficiency: agent.efficiency,
        online: agent.online,
        cooldownRemainingSeconds: agent.cooldownRemainingSeconds,
        cooldownType: agent.cooldownType,
        cooldownTargetLocId: agent.cooldownTargetLocId,
        lastGoalTime: agent.lastGoalTime,
        conversations: agent.conversations ?? [],
      };

      const entity = new AgentEntity(entityData, this.app);
      if (this.spritesLoaded) {
        entity.setSpriteCache({ walkFrames: this.walkFrames, idleFrames: this.idleFrames });
      }

      this.agents.set(agent.id, entity);
      this.agentsContainer.addChild(entity.container);
    }

    console.log(`[AgentManager] Created ${this.agents.size} agents`);
  }

  update(dt: number, speed: number): void {
    const allAgents = Array.from(this.agents.values());
    for (const agent of allAgents) {
      agent.update(dt, speed);
    }
  }

  syncFromStore(): void {
    const store = useGameStore.getState();
    const storeAgents = store.agents;

    for (const storeAgent of storeAgents) {
      const entity = this.agents.get(storeAgent.id);
      if (entity) {
        // Position (x/y/targetX/targetY) and simulation values (energy/efficiency/mood)
        // are owned by the entity and written TO the store — never read back from it.
        entity.updateFromStore({
          name: storeAgent.name,
          online: storeAgent.online,
          workStatus: storeAgent.workStatus,
          fsmState: storeAgent.fsmState,
          conversations: storeAgent.conversations,
        });
      }
    }

    // Handle new agents
    for (const storeAgent of storeAgents) {
      if (!this.agents.has(storeAgent.id)) {
        this.addAgent(storeAgent);
      }
    }

    // Handle removed agents
    for (const [id, entity] of this.agents) {
      if (!storeAgents.find(a => a.id === id)) {
        entity.destroy();
        this.agents.delete(id);
      }
    }
  }

  private addAgent(agent: Agent): void {
    const location = findLocationByRole(agent.role);
    const startX = location?.x ?? agent.x ?? CANVAS.width / 2;
    const startY = location?.y ?? agent.y ?? CANVAS.height / 2;

    const entityData: AgentEntityData = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      color: agent.color ?? ROLE_COLORS[agent.role] ?? 0xffffff,
      x: startX,
      y: startY,
      targetX: agent.targetX ?? startX,
      targetY: agent.targetY ?? startY,
      state: agent.state as AgentEntityData['state'],
      energy: agent.energy,
      maxEnergy: agent.maxEnergy,
      mood: agent.mood,
      workStatus: agent.workStatus,
      fsmState: agent.fsmState,
      efficiency: agent.efficiency,
      online: agent.online,
      cooldownRemainingSeconds: agent.cooldownRemainingSeconds,
      cooldownType: agent.cooldownType,
      cooldownTargetLocId: agent.cooldownTargetLocId,
      lastGoalTime: agent.lastGoalTime,
      conversations: agent.conversations ?? [],
    };

    const entity = new AgentEntity(entityData, this.app);
    if (this.spritesLoaded) {
      entity.setSpriteCache({ walkFrames: this.walkFrames, idleFrames: this.idleFrames });
    }

    this.agents.set(agent.id, entity);
    this.agentsContainer.addChild(entity.container);
  }

  getAgent(id: string): AgentEntity | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AgentEntity[] {
    return Array.from(this.agents.values());
  }

  setSelectedAgent(id: string | null): void {
    for (const [aid, agent] of this.agents) {
      agent.setSelected(aid === id);
    }
  }

  destroy(): void {
    this.agents.forEach(a => a.destroy());
    this.agents.clear();
    this.agentsContainer.destroy({ children: true });
    this.walkFrames = [];
    this.idleFrames = [];
  }
}