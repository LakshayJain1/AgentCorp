import { Application, Container, Sprite, Graphics, Texture, Rectangle, Assets } from 'pixi.js';
import { useGameStore } from '@/store/gameStore';
import { Agent } from '@/agents/AgentTypes';
import { AgentEntity, AgentEntityData } from './AgentEntity';
import { CANVAS, toOfficeLocations, findLocationByRole } from './PixiOfficeLayout';

const ROLES = ['ceo', 'hr', 'pm', 'researcher', 'engineer', 'qa'] as const;
const ROLE_COLORS: Record<string, number> = {
  ceo: 0xff6b6b,
  pm: 0x4ecdc4,
  researcher: 0x45b7d1,
  engineer: 0xf9ca24,
  qa: 0xa29bfe,
  hr: 0xf472b6,
};

// All roles share the same sprite sheets from the CEO folder
// These are 64x16 PNGs with 4 frames horizontally (16x16 each)
const SHARED_SPRITE_PATH = '/sprites/agents/ceo';

// Walk animation: 4 directions, each is a 64x16 sprite sheet with 4 frames
const WALK_SPRITES: Record<string, string> = {
  right: 'ceo-walk-right.png',
  left: 'ceo-walk-left.png',
  down: 'ceo-walk-down.png',
  up: 'ceo-walk-up.png',
};

// Idle animation: 4 directions (the idle-point files also have 4 frames)
const IDLE_SPRITES: Record<string, string> = {
  right: 'ceo-idle-point-right.png',
  left: 'ceo-idle-point-left.png',
  down: 'ceo-idle-point-left.png',
  up: 'ceo-idle-point-right.png',
};

export class AgentManager {
  private app: Application;
  private agentsContainer: Container;
  private agents: Map<string, AgentEntity> = new Map();
  // Cache: direction -> { walkTexture: Texture, idleTextures: Texture[] }
  private spriteCache: Map<string, { walkTexture: Texture; idleTextures: Texture[] }> = new Map();
  private spritesLoaded = false;

  constructor(app: Application) {
    this.app = app;
    this.agentsContainer = new Container();
    this.agentsContainer.zIndex = 10;
    this.app.stage.addChild(this.agentsContainer);
  }

  async loadSprites(): Promise<void> {
    if (this.spritesLoaded) return;

    // Load walk sprite sheets from CEO folder
    const walkPromises = Object.values(WALK_SPRITES).map((filename) => {
      const path = `${SHARED_SPRITE_PATH}/${filename}`;
      return Assets.load(path).then((texture: Texture) => {
        // Store the full 64x16 texture; we'll manually cycle frames in the update loop
        const dirKey = filename.replace('.png', '');
        return { dirKey, texture };
      });
    });

    // Load idle sprite sheets from CEO folder
    const idlePromises = Object.values(IDLE_SPRITES).map((filename) => {
      const path = `${SHARED_SPRITE_PATH}/${filename}`;
      return Assets.load(path).then((texture: Texture) => {
        const dirKey = filename.replace('.png', '');
        return { dirKey, texture };
      });
    });

    const [walkResults, idleResults] = await Promise.all([
      Promise.all(walkPromises),
      Promise.all(idlePromises),
    ]);

    // Cache textures per direction
    for (const result of walkResults) {
      this.spriteCache.set(result.dirKey, { walkTexture: result.texture, idleTextures: [] });
    }

    for (const result of idleResults) {
      if (this.spriteCache.has(result.dirKey)) {
        this.spriteCache.get(result.dirKey)!.idleTextures.push(result.texture);
      }
    }

    this.spritesLoaded = true;
    console.log('[AgentManager] Sprites loaded from CEO folder,', this.spriteCache.size, 'directions cached');
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
      
      // Get cached sprites - try agent's role first, then fall back to any role with sprites
      let cached = this.spriteCache.get(agent.role);
      if (!cached) {
        for (const r of ROLES) {
          cached = this.spriteCache.get(r);
          if (cached && (cached.idleTextures.length > 0 || cached.walkTexture)) {
            break;
          }
        }
      }
      
      if (cached && (cached.idleTextures.length > 0 || cached.walkTexture)) {
        entity.setSpriteCache(cached);
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
        entity.updateFromStore({
          name: storeAgent.name,
          x: storeAgent.x,
          y: storeAgent.y,
          targetX: storeAgent.targetX,
          targetY: storeAgent.targetY,
          state: storeAgent.state as AgentEntityData['state'],
          energy: storeAgent.energy,
          mood: storeAgent.mood,
          workStatus: storeAgent.workStatus,
          fsmState: storeAgent.fsmState,
          efficiency: storeAgent.efficiency,
          online: storeAgent.online,
          cooldownRemainingSeconds: storeAgent.cooldownRemainingSeconds,
          cooldownType: storeAgent.cooldownType,
          cooldownTargetLocId: storeAgent.cooldownTargetLocId,
          lastGoalTime: storeAgent.lastGoalTime,
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
    const cached = this.spriteCache.get(agent.role);
    if (cached) {
      entity.setSpriteCache(cached);
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
    this.spriteCache.clear();
  }
}