/**
 * A small, safe arithmetic evaluator for the agent's `calculate` tool.
 *
 * Language models are unreliable at multi-step arithmetic, so the loop gives them
 * a calculator instead of trusting mental maths. This is a hand-written parser:
 * it never calls eval/Function, so an expression can only ever produce a number.
 *
 * Grammar:  + - * / % ^ (or **), parentheses, unary minus, numbers (1,234.5 style
 * thousands separators are NOT accepted; write 1234.5), percent literals (15%),
 * and the functions abs round floor ceil sqrt min max sum avg.
 */

const MAX_LENGTH = 2000;
const MAX_DEPTH = 60;

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`bad number at position ${i + 1}`);
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-z_]/i.test(c)) {
      const m = /^[a-z_][a-z0-9_]*/i.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
      continue;
    }
    if (c === '*' && src[i + 1] === '*') { out.push({ t: 'op', v: '^' }); i += 2; continue; }
    if ('+-*/%^(),'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`unexpected character "${c}"`);
  }
  return out;
}

const FUNCS: Record<string, (a: number[]) => number> = {
  abs: (a) => Math.abs(need(a, 1)[0]),
  floor: (a) => Math.floor(need(a, 1)[0]),
  ceil: (a) => Math.ceil(need(a, 1)[0]),
  sqrt: (a) => {
    const x = need(a, 1)[0];
    if (x < 0) throw new Error('sqrt of a negative number');
    return Math.sqrt(x);
  },
  round: (a) => {
    if (a.length < 1 || a.length > 2) throw new Error('round takes (value) or (value, decimals)');
    const d = a.length === 2 ? a[1] : 0;
    if (!Number.isInteger(d) || d < 0 || d > 10) throw new Error('round decimals must be an integer from 0 to 10');
    const f = 10 ** d;
    return Math.round((a[0] + Number.EPSILON) * f) / f;
  },
  min: (a) => Math.min(...atLeast(a, 1)),
  max: (a) => Math.max(...atLeast(a, 1)),
  sum: (a) => atLeast(a, 1).reduce((x, y) => x + y, 0),
  avg: (a) => atLeast(a, 1).reduce((x, y) => x + y, 0) / a.length,
};

function need(a: number[], n: number): number[] {
  if (a.length !== n) throw new Error(`function takes exactly ${n} argument(s)`);
  return a;
}
function atLeast(a: number[], n: number): number[] {
  if (a.length < n) throw new Error(`function needs at least ${n} argument(s)`);
  return a;
}

export function evaluate(expression: string): number {
  if (typeof expression !== 'string' || !expression.trim()) throw new Error('empty expression');
  if (expression.length > MAX_LENGTH) throw new Error('expression too long');
  const toks = tokenize(expression);
  let p = 0;
  let depth = 0;

  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;

  function expr(): number {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: string }).v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = (toks[p++] as { v: string }).v;
      const r = unary();
      if ((op === '/' || op === '%') && r === 0) throw new Error('division by zero');
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }
  function unary(): number {
    if (isOp('-')) { p++; return -unary(); }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power(): number {
    const base = postfix();
    if (isOp('^')) { p++; return base ** unary(); } // right associative: 2^3^2 = 2^(3^2)
    return base;
  }
  function postfix(): number {
    let v = atom();
    // "15%" means 0.15, but "10 % 3" (a number follows) is modulo and is handled in term().
    while (isOp('%')) {
      const next = toks[p + 1];
      const startsOperand = next && (next.t === 'num' || next.t === 'id' || (next.t === 'op' && (next.v === '(' || next.v === '-' || next.v === '+')));
      if (startsOperand) break;
      p++;
      v /= 100;
    }
    return v;
  }
  function atom(): number {
    if (++depth > MAX_DEPTH) throw new Error('expression nested too deeply');
    try {
      const t = toks[p++];
      if (!t) throw new Error('unexpected end of expression');
      if (t.t === 'num') return t.v;
      if (t.t === 'op' && t.v === '(') {
        const v = expr();
        if (!isOp(')')) throw new Error('missing closing parenthesis');
        p++;
        return v;
      }
      if (t.t === 'id') {
        if (t.v === 'pi') return Math.PI;
        const fn = FUNCS[t.v];
        if (!fn) throw new Error(`unknown name "${t.v}"`);
        if (!isOp('(')) throw new Error(`${t.v} must be called like ${t.v}(...)`);
        p++;
        const args: number[] = [];
        if (!isOp(')')) {
          args.push(expr());
          while (isOp(',')) { p++; args.push(expr()); }
        }
        if (!isOp(')')) throw new Error('missing closing parenthesis');
        p++;
        return fn(args);
      }
      throw new Error(`unexpected "${t.v}"`);
    } finally {
      depth--;
    }
  }

  const result = expr();
  if (p < toks.length) throw new Error(`unexpected "${(toks[p] as { v: unknown }).v}"`);
  if (!Number.isFinite(result)) throw new Error('result is not a finite number');
  return result;
}

/** Print without binary-float noise (0.1 + 0.2 gives 0.3, not 0.30000000000000004). */
export function formatNumber(n: number): string {
  const cleaned = Number(n.toPrecision(14));
  const s = String(cleaned);
  return s.includes('e') ? cleaned.toExponential() : s;
}
