import { loadPersonalitiesFromConfig, loadSystemPrompts } from '@/ai/AgentPersonalities';
import { loadGameConfig } from '@/store/gameStore';
import { loadIntentPatterns } from '@/ai/IntentClassifier';
import { configLoader } from './ConfigLoader';

let preloadPromise: Promise<void> | null = null;

/**
 * Memoized by promise, not by flag: a second caller (React strict-mode double
 * effect, engine restart) must wait for the first load to finish rather than
 * return early while configs are still being parsed.
 */
export function preloadAllConfigs(): Promise<void> {
  if (!preloadPromise) preloadPromise = doPreload();
  return preloadPromise;
}

async function doPreload(): Promise<void> {
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
