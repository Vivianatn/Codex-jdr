/**
 * Dice notation parser (SPEC §7): `1d20`, `2d20/2`, `3d6+2`, `2d20kh1`,
 * `2d20kl1`, `4d6dl1`, `d%`, parentheses and + − × / combinations.
 *
 * Grammar:
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | 'x' | '/') unary)*
 *   unary   := '-' unary | primary
 *   primary := number | dice | '(' expr ')'
 *   dice    := [count] 'd' (sides | '%') [('kh' | 'kl' | 'k' | 'dh' | 'dl') [n]]
 */

export const LIMITS = { maxDice: 100, maxSides: 1000, maxLength: 120 } as const

export type KeepMode = 'kh' | 'kl' | 'dh' | 'dl'

export type DiceNode =
  | { type: 'number'; value: number }
  | {
      type: 'dice'
      count: number
      sides: number
      keep: { mode: KeepMode; n: number } | null
      source: string
    }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: DiceNode; right: DiceNode }
  | { type: 'negate'; operand: DiceNode }

export type DiceErrorCode =
  | 'empty'
  | 'tooLong'
  | 'unexpected'
  | 'unexpectedEnd'
  | 'missingParen'
  | 'tooManyDice'
  | 'badSides'
  | 'badKeep'
  | 'noDice'

export class DiceSyntaxError extends Error {
  constructor(
    readonly code: DiceErrorCode,
    /** Position (0-based) in the original text, when relevant. */
    readonly position: number,
    /** The offending text, when relevant. */
    readonly found = '',
  ) {
    super(`Invalid dice expression (${code} at ${position}${found ? `: "${found}"` : ''})`)
    this.name = 'DiceSyntaxError'
  }
}

interface Token {
  kind: 'number' | 'd' | 'percent' | 'keep' | 'op' | 'lparen' | 'rparen'
  text: string
  pos: number
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    const rest = input.slice(i)
    const number = rest.match(/^\d+/)
    const keep = rest.match(/^(kh|kl|dh|dl|k)/i)
    if (number) {
      tokens.push({ kind: 'number', text: number[0], pos: i })
      i += number[0].length
    } else if (
      keep &&
      tokens.at(-1) &&
      ['number', 'percent'].includes(tokens.at(-1)!.kind) &&
      tokens.some((t) => t.kind === 'd')
    ) {
      tokens.push({ kind: 'keep', text: keep[0].toLowerCase(), pos: i })
      i += keep[0].length
    } else if (/[dD]/.test(ch)) {
      tokens.push({ kind: 'd', text: 'd', pos: i++ })
    } else if (ch === '%') {
      tokens.push({ kind: 'percent', text: '%', pos: i++ })
    } else if ('+-*/xX×÷'.includes(ch)) {
      const op = ch === 'x' || ch === 'X' || ch === '×' ? '*' : ch === '÷' ? '/' : ch
      tokens.push({ kind: 'op', text: op, pos: i++ })
    } else if (ch === '(') {
      tokens.push({ kind: 'lparen', text: ch, pos: i++ })
    } else if (ch === ')') {
      tokens.push({ kind: 'rparen', text: ch, pos: i++ })
    } else {
      throw new DiceSyntaxError('unexpected', i, ch)
    }
  }
  return tokens
}

export function parseDice(input: string): DiceNode {
  const text = input.trim()
  if (!text) throw new DiceSyntaxError('empty', 0)
  if (text.length > LIMITS.maxLength) throw new DiceSyntaxError('tooLong', LIMITS.maxLength)
  const tokens = tokenize(text)
  let index = 0
  const peek = () => tokens[index]
  const next = () => tokens[index++]
  const end = text.length

  function expect(kind: Token['kind']): Token {
    const token = next()
    if (!token) throw new DiceSyntaxError(kind === 'rparen' ? 'missingParen' : 'unexpectedEnd', end)
    if (token.kind !== kind) throw new DiceSyntaxError('unexpected', token.pos, token.text)
    return token
  }

  function dice(countToken: Token | null): DiceNode {
    const d = expect('d')
    const count = countToken ? Number(countToken.text) : 1
    const sidesToken = next()
    if (!sidesToken) throw new DiceSyntaxError('unexpectedEnd', end)
    let sides: number
    if (sidesToken.kind === 'percent') sides = 100
    else if (sidesToken.kind === 'number') sides = Number(sidesToken.text)
    else throw new DiceSyntaxError('unexpected', sidesToken.pos, sidesToken.text)
    if (count < 1 || count > LIMITS.maxDice)
      throw new DiceSyntaxError('tooManyDice', countToken?.pos ?? d.pos, String(count))
    if (sides < 2 || sides > LIMITS.maxSides)
      throw new DiceSyntaxError('badSides', sidesToken.pos, String(sides))

    let keep: { mode: KeepMode; n: number } | null = null
    if (peek()?.kind === 'keep') {
      const k = next()!
      const mode: KeepMode = k.text === 'k' ? 'kh' : (k.text as KeepMode)
      let n = 1
      if (peek()?.kind === 'number') n = Number(next()!.text)
      const valid = mode.startsWith('k') ? n >= 1 && n <= count : n >= 0 && n < count
      if (!valid) throw new DiceSyntaxError('badKeep', k.pos, k.text + n)
      keep = { mode, n }
    }
    const last = tokens[index - 1]!
    const source = text
      .slice(countToken?.pos ?? d.pos, last.pos + last.text.length)
      .replace(/\s+/g, '')
    return { type: 'dice', count, sides, keep, source }
  }

  function primary(): DiceNode {
    const token = peek()
    if (!token) throw new DiceSyntaxError('unexpectedEnd', end)
    if (token.kind === 'lparen') {
      next()
      const node = expr()
      expect('rparen')
      return node
    }
    if (token.kind === 'd') return dice(null)
    if (token.kind === 'number') {
      next()
      if (peek()?.kind === 'd') return dice(token)
      return { type: 'number', value: Number(token.text) }
    }
    throw new DiceSyntaxError('unexpected', token.pos, token.text)
  }

  function unary(): DiceNode {
    if (peek()?.kind === 'op' && peek()!.text === '-') {
      next()
      return { type: 'negate', operand: unary() }
    }
    if (peek()?.kind === 'op' && peek()!.text === '+') next()
    return primary()
  }

  function term(): DiceNode {
    let node = unary()
    while (peek()?.kind === 'op' && (peek()!.text === '*' || peek()!.text === '/')) {
      const op = next()!.text as '*' | '/'
      node = { type: 'binary', op, left: node, right: unary() }
    }
    return node
  }

  function expr(): DiceNode {
    let node = term()
    while (peek()?.kind === 'op' && (peek()!.text === '+' || peek()!.text === '-')) {
      const op = next()!.text as '+' | '-'
      node = { type: 'binary', op, left: node, right: term() }
    }
    return node
  }

  const node = expr()
  const leftover = peek()
  if (leftover)
    throw new DiceSyntaxError(
      leftover.kind === 'rparen' ? 'unexpected' : 'unexpected',
      leftover.pos,
      leftover.text,
    )
  return node
}

/** True if the expression contains at least one die (used to validate damage/heal fields). */
export function hasDice(node: DiceNode): boolean {
  switch (node.type) {
    case 'dice':
      return true
    case 'number':
      return false
    case 'negate':
      return hasDice(node.operand)
    case 'binary':
      return hasDice(node.left) || hasDice(node.right)
  }
}

/** Throws unless `text` is a valid expression; returns the parsed tree. */
export function validateDice(text: string, { requireDice = false } = {}): DiceNode {
  const node = parseDice(text)
  if (requireDice && !hasDice(node)) throw new DiceSyntaxError('noDice', 0)
  return node
}
