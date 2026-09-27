// Safe expression system (brief §13).
//
// Widget calculations are authored as short arithmetic strings —
// `bedrooms * 35 + bathrooms * 25` — and those strings arrive from two
// untrusted places: an AI model, and whatever a widget's JSON contains after
// someone has edited it. So they are never executed as JavaScript. There is
// no eval, no Function constructor, no `with`, no property access, no member
// lookup and no way to reach a host object from inside an expression.
//
// Instead the source is tokenised, parsed into a tiny AST of five node kinds,
// and walked by an evaluator that can only do arithmetic. Every identifier is
// checked against the widget's known field ids at COMPILE time, so a
// hallucinated variable is a build-time error the builder can show, not a
// runtime `undefined`.
//
// Allowed: + - * / %, unary minus, parentheses, and the functions
// min, max, round, ceil, floor. Nothing else parses.

/** The only functions an expression may call (§13). */
export const ALLOWED_FUNCTIONS = ["min", "max", "round", "ceil", "floor"] as const;
export type AllowedFunction = (typeof ALLOWED_FUNCTIONS)[number];

/** Arity limits, so `round(1,2,3)` is rejected rather than quietly ignored. */
const FUNCTION_ARITY: Record<AllowedFunction, { min: number; max: number }> = {
  min: { min: 1, max: 8 },
  max: { min: 1, max: 8 },
  round: { min: 1, max: 2 }, // round(x) or round(x, decimals)
  ceil: { min: 1, max: 1 },
  floor: { min: 1, max: 1 },
};

/** Belt-and-braces limits against pathological input. */
const MAX_SOURCE_LENGTH = 2000;
const MAX_DEPTH = 32;

export type ExprNode =
  | { kind: "number"; value: number }
  | { kind: "var"; name: string }
  | { kind: "unary"; op: "-"; operand: ExprNode }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "%"; left: ExprNode; right: ExprNode }
  | { kind: "call"; fn: AllowedFunction; args: ExprNode[] };

export class ExpressionError extends Error {
  constructor(message: string, readonly position?: number) {
    super(message);
    this.name = "ExpressionError";
  }
}

/* ------------------------------------------------------------------ */
/* Tokeniser                                                           */
/* ------------------------------------------------------------------ */

type Token =
  | { type: "number"; value: number; pos: number }
  | { type: "ident"; value: string; pos: number }
  | { type: "op"; value: string; pos: number }
  | { type: "eof"; pos: number };

const OPERATOR_CHARS = new Set(["+", "-", "*", "/", "%", "(", ")", ","]);

function tokenise(source: string): Token[] {
  if (source.length > MAX_SOURCE_LENGTH) {
    throw new ExpressionError("Expression is too long.");
  }

  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (OPERATOR_CHARS.has(char)) {
      tokens.push({ type: "op", value: char, pos: i });
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      const start = i;
      while (i < source.length && /[0-9]/.test(source[i])) i += 1;
      if (source[i] === ".") {
        i += 1;
        while (i < source.length && /[0-9]/.test(source[i])) i += 1;
      }
      const raw = source.slice(start, i);
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new ExpressionError(`"${raw}" is not a valid number.`, start);
      }
      tokens.push({ type: "number", value, pos: start });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = i;
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i += 1;
      tokens.push({ type: "ident", value: source.slice(start, i), pos: start });
      continue;
    }

    // Anything else — quotes, dots, brackets, backticks, semicolons — is not
    // part of the language. Rejecting here is what makes injection impossible.
    throw new ExpressionError(`Unexpected character "${char}".`, i);
  }

  tokens.push({ type: "eof", pos: source.length });
  return tokens;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

const BINARY_PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.index];
  }

  private next(): Token {
    return this.tokens[this.index++];
  }

  private expectOp(value: string): void {
    const token = this.next();
    if (token.type !== "op" || token.value !== value) {
      throw new ExpressionError(`Expected "${value}".`, token.pos);
    }
  }

  parse(): ExprNode {
    const node = this.parseBinary(0, 0);
    const token = this.peek();
    if (token.type !== "eof") {
      throw new ExpressionError("Unexpected trailing input.", token.pos);
    }
    return node;
  }

  private parseBinary(minPrecedence: number, depth: number): ExprNode {
    if (depth > MAX_DEPTH) throw new ExpressionError("Expression is nested too deeply.");

    let left = this.parseUnary(depth + 1);

    for (;;) {
      const token = this.peek();
      if (token.type !== "op") break;
      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) break;

      this.next();
      // Left-associative: the right operand binds tighter by one level.
      const right = this.parseBinary(precedence + 1, depth + 1);
      left = { kind: "binary", op: token.value as "+", left, right };
    }

    return left;
  }

  private parseUnary(depth: number): ExprNode {
    if (depth > MAX_DEPTH) throw new ExpressionError("Expression is nested too deeply.");

    const token = this.peek();
    if (token.type === "op" && token.value === "-") {
      this.next();
      return { kind: "unary", op: "-", operand: this.parseUnary(depth + 1) };
    }
    if (token.type === "op" && token.value === "+") {
      this.next(); // unary plus is a no-op
      return this.parseUnary(depth + 1);
    }
    return this.parsePrimary(depth + 1);
  }

  private parsePrimary(depth: number): ExprNode {
    if (depth > MAX_DEPTH) throw new ExpressionError("Expression is nested too deeply.");

    const token = this.next();

    if (token.type === "number") return { kind: "number", value: token.value };

    if (token.type === "ident") {
      const nextToken = this.peek();
      const isCall = nextToken.type === "op" && nextToken.value === "(";

      if (!isCall) return { kind: "var", name: token.value };

      const fn = token.value as AllowedFunction;
      if (!(ALLOWED_FUNCTIONS as readonly string[]).includes(fn)) {
        throw new ExpressionError(`"${token.value}" is not an allowed function.`, token.pos);
      }

      this.expectOp("(");
      const args: ExprNode[] = [];
      const closer = this.peek();
      if (!(closer.type === "op" && closer.value === ")")) {
        for (;;) {
          args.push(this.parseBinary(0, depth + 1));
          const separator = this.peek();
          if (separator.type === "op" && separator.value === ",") {
            this.next();
            continue;
          }
          break;
        }
      }
      this.expectOp(")");

      const arity = FUNCTION_ARITY[fn];
      if (args.length < arity.min || args.length > arity.max) {
        throw new ExpressionError(
          `${fn}() takes ${arity.min === arity.max ? arity.min : `${arity.min}–${arity.max}`} argument(s).`,
          token.pos
        );
      }
      return { kind: "call", fn, args };
    }

    if (token.type === "op" && token.value === "(") {
      const node = this.parseBinary(0, depth + 1);
      this.expectOp(")");
      return node;
    }

    throw new ExpressionError("Expression is incomplete.", token.pos);
  }
}

/* ------------------------------------------------------------------ */
/* Compile + evaluate                                                  */
/* ------------------------------------------------------------------ */

export interface CompiledExpression {
  source: string;
  ast: ExprNode;
  /** Field ids the expression reads. Useful for dependency hints in the UI. */
  variables: string[];
}

/** Collects every identifier an AST reads. */
export function collectVariables(node: ExprNode, into: Set<string> = new Set()): Set<string> {
  switch (node.kind) {
    case "var":
      into.add(node.name);
      break;
    case "unary":
      collectVariables(node.operand, into);
      break;
    case "binary":
      collectVariables(node.left, into);
      collectVariables(node.right, into);
      break;
    case "call":
      node.args.forEach((arg) => collectVariables(arg, into));
      break;
    case "number":
      break;
  }
  return into;
}

/**
 * Parse an expression and check its variables against the fields the widget
 * actually has. `knownFields` omitted means "don't check" — used when parsing
 * before the field list is settled.
 */
export function compileExpression(source: string, knownFields?: Iterable<string>): CompiledExpression {
  const trimmed = (source ?? "").trim();
  if (!trimmed) throw new ExpressionError("Expression is empty.");

  const ast = new Parser(tokenise(trimmed)).parse();
  const variables = [...collectVariables(ast)];

  if (knownFields) {
    const known = new Set(knownFields);
    const unknown = variables.filter((name) => !known.has(name));
    if (unknown.length > 0) {
      throw new ExpressionError(
        `Unknown field${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`
      );
    }
  }

  return { source: trimmed, ast, variables };
}

/** True when `source` parses and only references known fields. */
export function isValidExpression(source: string, knownFields?: Iterable<string>): boolean {
  try {
    compileExpression(source, knownFields);
    return true;
  } catch {
    return false;
  }
}

/**
 * Coerce a widget answer into a number.
 *
 * - booleans      → 1 / 0            (a toggle worth $30 is `oven * 30`)
 * - arrays        → sum of members   (multi-select extras add up)
 * - numeric text  → the number
 * - anything else → 0                (a text answer has no arithmetic meaning)
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + toNumber(item), 0);
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export type Scope = Record<string, unknown>;

/**
 * Walk the AST. Only arithmetic happens here — there is no path from this
 * function to anything outside it. Non-finite results collapse to 0 so a
 * divide-by-zero shows as "$0", never "Infinity" or "NaN" on a customer's
 * screen.
 */
export function evaluate(node: ExprNode, scope: Scope): number {
  const result = evaluateNode(node, scope);
  return Number.isFinite(result) ? result : 0;
}

function evaluateNode(node: ExprNode, scope: Scope): number {
  switch (node.kind) {
    case "number":
      return node.value;

    case "var":
      // Own properties only. `constructor`, `__proto__` and friends are legal
      // identifiers, so this is what stops them reaching Object.prototype.
      return Object.prototype.hasOwnProperty.call(scope, node.name)
        ? toNumber(scope[node.name])
        : 0;

    case "unary":
      return -evaluateNode(node.operand, scope);

    case "binary": {
      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return right === 0 ? 0 : left / right;
        case "%":
          return right === 0 ? 0 : left % right;
      }
      return 0;
    }

    case "call": {
      const args = node.args.map((arg) => evaluateNode(arg, scope));
      switch (node.fn) {
        case "min":
          return Math.min(...args);
        case "max":
          return Math.max(...args);
        case "round": {
          const [value, decimals = 0] = args;
          const factor = 10 ** Math.max(0, Math.min(6, Math.trunc(decimals)));
          return Math.round(value * factor) / factor;
        }
        case "ceil":
          return Math.ceil(args[0]);
        case "floor":
          return Math.floor(args[0]);
      }
      return 0;
    }
  }
}

/** Parse-and-run in one step. Returns `fallback` if the expression is invalid. */
export function evaluateExpression(source: string, scope: Scope, fallback = 0): number {
  try {
    return evaluate(compileExpression(source).ast, scope);
  } catch {
    return fallback;
  }
}
