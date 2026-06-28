import { loadPersonalitiesFromConfig, loadSystemPrompts } from '@/ai/AgentPersonalities';
import { loadGameConfig } from '@/store/gameStore';
import { loadIntentPatterns } from '@/ai/IntentClassifier';
import { configLoader } from './ConfigLoader';

let preloaded = false;

export async function preloadAllConfigs(): Promise<void> {
  if (preloaded) return;
  preloaded = true;

  try {
    // Fetch all config files in parallel
    await Promise.all([
      configLoader.fetchText('/config/game-config.md'),
      configLoader.fetchText('/config/intent-patterns.md'),
      configLoader.fetchText('/config/agent-personalities.md'),
      configLoader.fetchText('/config/deliverable-templates.md'),
    ]);
  } catch (e) {
    console.warn('[Config] Some config files failed to load, using defaults:', e);
  }

  // Parse and cache each config
  await Promise.all([
    loadPersonalitiesFromConfig(),
    loadSystemPrompts(),
    loadGameConfig(),
    loadIntentPatterns(),
  ]);

  console.log('[Config] All configs loaded');
}
