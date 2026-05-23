import { useGameStore } from '@/store/gameStore';
import { Task } from '@/agents/AgentTypes';
import { aiService } from '@/ai/AIService';
import { buildSystemPrompt } from '@/ai/AgentPersonalities';
import { simpleRuntime } from '@/runtime/SimpleRuntime';

export async function startTaskReview(task: Task): Promise<void> {
  const store = useGameStore.getState();

  // Find the PM — they lead task review
  const pm = store.agents.find((a) => a.role === 'pm');

  if (!pm) {
    simpleRuntime.executeTask(task);
    return;
  }

  // Check if AI is available — if not, skip review and execute
  const hasKey = await aiService.checkApiKey();
  if (!hasKey) {
    simpleRuntime.executeTask(task);
    return;
  }

  // ── Phase 1: PM thinks about the task ──
  // Using workStatus 'thinking' — GameScene sync maps this to visual state 'communicating'
  // so the speech bubble shows up on canvas
  store.updateWorkStatus(pm.id, 'thinking');
  store.pushAgentActivity(pm.id, {
    id: crypto.randomUUID(),
    agentId: pm.id,
    type: 'thinking',
    message: `Reviewing new task: "${task.title}"`,
    details: 'Evaluating what this task needs and whether external credentials are required',
    timestamp: Date.now(),
  });

  const pmSystemPrompt = buildSystemPrompt('pm', pm.name);
  const pmReviewPrompt = `${pmSystemPrompt}

A new task has been created: "${task.title}"

Think about this task carefully:
1. What needs to be built or done?
2. Does this task require any EXTERNAL CREDENTIALS to complete? (API keys, auth tokens, passwords, cloud platform access keys, deployment secrets, database passwords, or any other secret that a human operator would need to provide)
3. If it needs credentials, what kind?

After your analysis, end your response with EXACTLY one of these tags:
- [NEEDS:<credential_type>] — if the task needs external credentials (e.g. [NEEDS:api_key], [NEEDS:deploy_creds], [NEEDS:automation_creds], [NEEDS:payment_creds])
- [READY] — if no credentials needed, ready to execute

Examples:
- "This task deploys to AWS production, so we need IAM access keys. [NEEDS:deploy_creds]"
- "Setting up n8n for Slack requires API tokens from both services. [NEEDS:automation_creds]"
- "This is a frontend CSS change, no external services needed. [READY]"`;

  const pmResponse = await aiService.askAgent('pm', pm.name, pm.traits, pmReviewPrompt, {
    taskTitle: task.title,
  });
  const pmMessage = pmResponse.content || `Let me evaluate "${task.title}".`;

  // ── Phase 2: Show PM's thinking to the user ──
  store.sendMessage(pm.id, pm.id, `📋 Task Review — "${task.title}": ${pmMessage}`);

  store.pushAgentActivity(pm.id, {
    id: crypto.randomUUID(),
    agentId: pm.id,
    type: 'thinking',
    message: pmMessage.slice(0, 300),
    timestamp: Date.now(),
  });

  // ── Phase 3: Parse the PM's decision from their response ──
  const needsTag = pmMessage.match(/\[NEEDS:([^\]]+)\]/);
  if (needsTag) {
    const credKey = needsTag[1].trim();
    const credLabel = credKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    store.updateWorkStatus(pm.id, 'idle');
    store.sendMessage(
      pm.id,
      pm.id,
      `🚨 I've determined that "${task.title}" requires ${credLabel}. These need to come from the human operator. Escalating now.`,
    );

    store.requestCredential(
      task.id,
      `PM determined during review: "${task.title}" needs ${credLabel}.`,
      credKey,
      credLabel,
    );
    return;
  }

  // ── Phase 4: PM says proceed — execute task ──
  store.updateWorkStatus(pm.id, 'coding');
  store.sendMessage(pm.id, pm.id, `✅ "${task.title}" reviewed — no external credentials needed. Proceeding to execution.`);

  // Brief delay so the user can see the PM's conclusion in the UI
  setTimeout(() => {
    simpleRuntime.executeTask(task);
  }, 1500);
}
