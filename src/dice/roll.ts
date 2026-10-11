import { parseDice, type DiceNode, type KeepMode } from './parser'
import { cryptoRng, rollDie, type Rng } from './rng'

export type Rounding = 'ceil' | 'floor' | 'half'

export interface DieResult {
  value: number
  /** False when dropped by kh/kl/dh/dl. */
  kept: boolean
}

export interface DiceGroupResult {
  /** "2d20kh1" as written. */
  source: string
  sides: number
  dice: DieResult[]
  total: number
}

export interface RollResult {
  expression: string
  total: number
  groups: DiceGroupResult[]
  /** Human-readable working: "[14, 9] / 2 = 11.5 → 12". */
  breakdown: string
}

export interface RollOptions {
  rng?: Rng
  /** How "/" rounds (the campaign's 2d20/2 rule). */
  rounding?: Rounding
}

function round(value: number, rounding: Rounding): number {
  if (rounding === 'half') return Math.round(value * 2) / 2
  return rounding === 'ceil' ? Math.ceil(value - 1e-9) : Math.floor(value + 1e-9)
}

function keptIndexes(values: number[], mode: KeepMode, n: number): Set<number> {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i)
  const pick =
    mode === 'kh'
      ? order.slice(-n)
      : mode === 'kl'
        ? order.slice(0, n)
        : mode === 'dh'
          ? order.slice(0, order.length - n)
          : order.slice(n)
  return new Set(pick.map((x) => x.i))
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ',')
}

/** Evaluates a parsed expression. Division keeps exact values until the final rounding. */
export function evaluate(node: DiceNode, options: RollOptions = {}): RollResult {
  const rng = options.rng ?? cryptoRng
  const rounding = options.rounding ?? 'ceil'
  const groups: DiceGroupResult[] = []
  let hasDivision = false

  const visit = (n: DiceNode, parentPrecedence = 0): { value: number; text: string } => {
    switch (n.type) {
      case 'number':
        return { value: n.value, text: String(n.value) }
      case 'dice': {
        const values = Array.from({ length: n.count }, () => rollDie(n.sides, rng))
        const kept = n.keep ? keptIndexes(values, n.keep.mode, n.keep.n) : null
        const dice = values.map((value, i) => ({ value, kept: kept ? kept.has(i) : true }))
        const total = dice.filter((d) => d.kept).reduce((s, d) => s + d.value, 0)
        groups.push({ source: n.source, sides: n.sides, dice, total })
        const shown = dice.map((d) => (d.kept ? String(d.value) : `~~${d.value}~~`)).join(', ')
        return { value: total, text: `[${shown}]` }
      }
      case 'negate': {
        const inner = visit(n.operand, 3)
        return { value: -inner.value, text: `-${inner.text}` }
      }
      case 'binary': {
        const precedence = n.op === '+' || n.op === '-' ? 1 : 2
        const left = visit(n.left, precedence)
        const right = visit(n.right, precedence + 1)
        let value: number
        switch (n.op) {
          case '+':
            value = left.value + right.value
            break
          case '-':
            value = left.value - right.value
            break
          case '*':
            value = left.value * right.value
            break
          case '/':
            hasDivision = true
            value = right.value === 0 ? 0 : left.value / right.value
            break
        }
        const symbol = n.op === '*' ? '×' : n.op === '-' ? '−' : n.op
        const text = `${left.text} ${symbol} ${right.text}`
        return { value, text: precedence < parentPrecedence ? `(${text})` : text }
      }
    }
  }

  const { value, text } = visit(node)
  const total = hasDivision ? round(value, rounding) : value
  const exact = formatNumber(value)
  const breakdown =
    hasDivision && total !== value
      ? `${text} = ${exact} → ${formatNumber(total)}`
      : text === exact
        ? text
        : `${text} = ${formatNumber(total)}`
  return { expression: '', total, groups, breakdown }
}

/** Parses and rolls in one go. Throws DiceSyntaxError on invalid notation. */
export function roll(expression: string, options: RollOptions = {}): RollResult {
  const result = evaluate(parseDice(expression), options)
  return { ...result, expression: expression.trim() }
}

/** Natural value of the first d20 actually kept (for criticals), or null. */
export function naturalD20(result: RollResult): number | null {
  const group = result.groups.find((g) => g.sides === 20)
  const kept = group?.dice.filter((d) => d.kept) ?? []
  return kept.length === 1 ? kept[0]!.value : null
}

/** Rewrites the first lone "1d20"/"d20" of an expression for advantage/disadvantage. */
export function withAdvantage(
  expression: string,
  mode: 'normal' | 'advantage' | 'disadvantage',
): string {
  if (mode === 'normal') return expression
  const keep = mode === 'advantage' ? 'kh1' : 'kl1'
  return expression.replace(
    /(^|[^\d])1?d20(?![\dkd%])/i,
    (_m, before: string) => `${before}2d20${keep}`,
  )
}
