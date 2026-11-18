/**
 * Which Linear writes does a run event cause? Pure: no store, no network, so it can be tested alone.
 *
 * Linear's workflow here is Backlog / Todo / In Progress / Done / Canceled (no "In Review"), so the
 * internal lifecycle maps to it like this:
 *   created -> Backlog | assigned -> Todo | work starts -> In Progress | QA / retries -> comments only
 *   finished and passed -> Done | finished but needs attention -> stays In Progress | stopped -> Canceled
 *
 * Every op carries a deterministic idempotency key (`<taskId>:<event>`), so replaying an event, a retry,
 * or a second browser tab can never double-post.
 */
import type { RunEvent } from './runEvents';
import { isAiUnavailableText } from '@/ai/aiMessages';

export type MirrorOp =
  | { type: 'comment'; key: string; author: string; body: string }
  | { type: 'status'; key: string; status: string }
  | { type: 'label'; key: string; label: string };

export interface PlanContext {
  taskId: string;
  /** "Mike (Engineer)" for an agent id, or null when unknown. */
  authorOf(agentId?: string): string | null;
  qaAuthor: string;
  pmAuthor: string;
  ceoAuthor: string;
  /** Role slug ("engineer") for an agent's first name ("Mike"); used for the `agent:<role>` label. */
  roleOfName(name: string): string | null;
  /** Position of this event among events of the same kind for the task (keeps keys stable on replay). */
  seq: number;
  /** Final facts about the run, known by the time `run.finished` arrives. */
  run?: { verdict?: 'passed' | 'needs_attention'; summary?: string };
}

/** The AI-failure placeholder is chat noise, not something the agent said: it must never land in a ticket. */
const clip = (text: string | undefined, n: number): string => {
  const t = isAiUnavailableText(text) ? '' : (text ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** " <text>" or nothing, so a dropped placeholder leaves no stray space. */
const tail = (text: string | undefined, n: number): string => {
  const t = clip(text, n);
  return t ? ` ${t}` : '';
};

const block = (text: string | undefined, n: number): string => {
  const t = clip(text, n);
  return t ? `\n\n\`\`\`\n${t}\n\`\`\`` : '';
};

export function planForEvent(ev: RunEvent, ctx: PlanContext): MirrorOp[] {
  const id = ctx.taskId;
  const tool = typeof ev.data?.tool === 'string' ? (ev.data.tool as string) : '';
  const actor = ctx.authorOf(ev.agentId) ?? ctx.pmAuthor;

  switch (ev.kind) {
    case 'tool.result': {
      if (tool === 'ceo:prioritize') {
        return [{ type: 'comment', key: `${id}:prioritized`, author: ctx.ceoAuthor, body: `Prioritized this task.${tail(ev.detail, 300)}` }];
      }
      if (tool === 'pm:assign') {
        const assignee = ev.message.replace(/^Assigned to\s+/i, '').trim();
        const role = ctx.roleOfName(assignee);
        const ops: MirrorOp[] = [
          { type: 'comment', key: `${id}:assigned`, author: ctx.pmAuthor, body: `${ev.message}.${tail(ev.detail, 300)}` },
          { type: 'status', key: `${id}:status:todo`, status: 'Todo' },
        ];
        if (role) ops.push({ type: 'label', key: `${id}:label:${role}`, label: `agent:${role}` });
        return ops;
      }
      return [];
    }

    case 'step.started': {
      if (tool !== 'generateDeliverable') return [];
      return [
        { type: 'status', key: `${id}:status:in_progress`, status: 'In Progress' },
        { type: 'comment', key: `${id}:started`, author: actor, body: 'Starting work on this.' },
      ];
    }

    case 'step.finished': {
      if (tool === 'generateDeliverable' && ev.status !== 'error') {
        return [{ type: 'comment', key: `${id}:delivered:${ctx.seq}`, author: actor, body: clip(ev.message, 400) }];
      }
      if (ev.subtaskId && /completed$/i.test(ev.message)) {
        return [{ type: 'comment', key: `${id}:subtask:${ctx.seq}`, author: actor, body: clip(ev.message, 400) }];
      }
      return [];
    }

    case 'validation.result': {
      const author = /^QA:/i.test(ev.message) ? ctx.qaAuthor : (ctx.authorOf(ev.agentId) ?? ctx.qaAuthor);
      const mark = ev.status === 'success' ? '✅' : '⚠️';
      return [{ type: 'comment', key: `${id}:qa:${ctx.seq}`, author, body: `${mark} ${clip(ev.message, 300)}${block(ev.detail, 1200)}` }];
    }

    case 'retry':
      return [{ type: 'comment', key: `${id}:retry:${ctx.seq}`, author: actor, body: `🔁 ${clip(ev.message, 300)}${block(ev.detail, 600)}` }];

    case 'run.finished': {
      const needsAttention = ctx.run?.verdict === 'needs_attention';
      const text = clip(ctx.run?.summary, 1500) || clip(ev.message, 300);
      const ops: MirrorOp[] = [
        { type: 'comment', key: `${id}:finished`, author: actor, body: needsAttention ? `⚠️ Needs attention. ${text}` : text },
      ];
      if (!needsAttention) ops.push({ type: 'status', key: `${id}:status:done`, status: 'Done' });
      return ops;
    }

    case 'run.failed': {
      if (ev.data?.stopped) {
        return [
          { type: 'comment', key: `${id}:failed`, author: ctx.pmAuthor, body: 'Stopped by the operator.' },
          { type: 'status', key: `${id}:status:canceled`, status: 'Canceled' },
        ];
      }
      return [{ type: 'comment', key: `${id}:failed`, author: actor, body: `❌ ${clip(ev.message, 300)}${block(ev.detail, 500)}` }];
    }

    default:
      return [];
  }
}

/** The text of the Linear issue created for a task. */
export function issueDraft(task: { id: string; title: string; description?: string }): { title: string; description: string } {
  const request = (task.description ?? '').trim();
  return {
    title: task.title.slice(0, 200),
    description: `${request || task.title}\n\n---\n_Mirrored by AgentCorp · task \`${task.id}\`_`,
  };
}

/** Pull "AGE-8" and the URL out of the text the create tool returns ("created AGE-8 "title" [Backlog] https://…"). */
export function parseCreated(output: string): { identifier: string; url: string } | null {
  const identifier = output.match(/\b([A-Z][A-Z0-9]{1,9}-\d+)\b/)?.[1];
  const url = output.match(/https?:\/\/\S+/)?.[0]?.replace(/[)\].,]+$/, '');
  return identifier ? { identifier, url: url ?? '' } : null;
}
