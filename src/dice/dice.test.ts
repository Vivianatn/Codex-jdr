import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DiceSyntaxError,
  naturalD20,
  parseDice,
  roll,
  seededRng,
  validateDice,
  withAdvantage,
  type DiceErrorCode,
} from '.'

/** An rng that returns the given die faces in order (for a die of `sides`). */
function faces(sides: number, ...values: number[]) {
  let i = 0
  return () => (values[i++ % values.length]! - 1 + 0.5) / sides
}

describe('parser: accepted notations (SPEC §7)', () => {
  it.each([
    '1d20',
    'd20',
    '2d20/2',
    '3d6+2',
    '2d20kh1',
    '2d20kl1',
    '4d6dl1',
    '4d6dh1',
    '2d20k',
    'd%',
    '1D8 + 1d6 - 2',
    '(1d6+2)*2',
    '2 x 1d4',
    '-1d4',
    '10',
    '  3d6 + 1d4 + (2d8kh1) / 2  ',
  ])('accepts "%s"', (expression) => {
    expect(() => parseDice(expression)).not.toThrow()
  })
})

describe('parser: rejected notations', () => {
  it.each<[string, DiceErrorCode]>([
    ['', 'empty'],
    ['   ', 'empty'],
    ['1d', 'unexpectedEnd'],
    ['d', 'unexpectedEnd'],
    ['2d20+', 'unexpectedEnd'],
    ['abc', 'unexpected'],
    ['1d20 ?', 'unexpected'],
    ['(1d6', 'missingParen'],
    ['1d6)', 'unexpected'],
    ['0d6', 'tooManyDice'],
    ['101d6', 'tooManyDice'],
    ['1d1', 'badSides'],
    ['1d1001', 'badSides'],
    ['2d20kh3', 'badKeep'],
    ['2d20dl2', 'badKeep'],
    ['1d20 1d6', 'unexpected'],
    ['1'.repeat(130), 'tooLong'],
  ])('rejects "%s" with %s', (expression, code) => {
    try {
      parseDice(expression)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(DiceSyntaxError)
      expect((e as DiceSyntaxError).code).toBe(code)
    }
  })

  it('reports the position of the problem', () => {
    try {
      parseDice('1d20 + ?')
    } catch (e) {
      expect((e as DiceSyntaxError).position).toBe(7)
      expect((e as DiceSyntaxError).found).toBe('?')
    }
  })

  it('can require at least one die', () => {
    expect(() => validateDice('5', { requireDice: true })).toThrow(DiceSyntaxError)
    expect(() => validateDice('1d4+1', { requireDice: true })).not.toThrow()
  })
})

describe('evaluation', () => {
  it('rolls 2d20/2 rounded up and explains the working', () => {
    const r = roll('2d20/2', { rng: faces(20, 14, 9) })
    expect(r.total).toBe(12)
    expect(r.groups[0]?.dice.map((d) => d.value)).toEqual([14, 9])
    expect(r.breakdown).toBe('[14, 9] / 2 = 11,5 → 12')
  })

  it('respects the rounding rule', () => {
    expect(roll('2d20/2', { rng: faces(20, 14, 9), rounding: 'floor' }).total).toBe(11)
    expect(roll('2d20/2', { rng: faces(20, 14, 9), rounding: 'half' }).total).toBe(11.5)
  })

  it('keeps the highest / lowest and drops the lowest', () => {
    expect(roll('2d20kh1', { rng: faces(20, 4, 17) }).total).toBe(17)
    expect(roll('2d20kl1', { rng: faces(20, 4, 17) }).total).toBe(4)
    const r = roll('4d6dl1', { rng: faces(6, 3, 1, 6, 4) })
    expect(r.total).toBe(13)
    expect(r.groups[0]?.dice).toEqual([
      { value: 3, kept: true },
      { value: 1, kept: false },
      { value: 6, kept: true },
      { value: 4, kept: true },
    ])
  })

  it('handles precedence, parentheses and negation', () => {
    expect(roll('2 + 3 * 4').total).toBe(14)
    expect(roll('(2 + 3) * 4').total).toBe(20)
    expect(roll('-1d4', { rng: faces(4, 3) }).total).toBe(-3)
    expect(roll('3d6+2', { rng: faces(6, 1, 2, 3) }).breakdown).toBe('[1, 2, 3] + 2 = 8')
  })

  it('finds the natural d20 kept', () => {
    expect(naturalD20(roll('2d20kh1+3', { rng: faces(20, 4, 17) }))).toBe(17)
    expect(naturalD20(roll('3d6'))).toBeNull()
  })

  it('rewrites a d20 for advantage and disadvantage', () => {
    expect(withAdvantage('1d20+5', 'advantage')).toBe('2d20kh1+5')
    expect(withAdvantage('d20', 'disadvantage')).toBe('2d20kl1')
    expect(withAdvantage('1d20', 'normal')).toBe('1d20')
    expect(withAdvantage('2d20/2', 'advantage')).toBe('2d20/2')
  })
})

describe('properties', () => {
  const seed = fc.integer({ min: 0, max: 2 ** 31 - 1 })

  it('2d20/2 rounded up is always an integer between 1 and 20', () => {
    fc.assert(
      fc.property(seed, (s) => {
        const { total } = roll('2d20/2', { rng: seededRng(s) })
        expect(Number.isInteger(total)).toBe(true)
        expect(total).toBeGreaterThanOrEqual(1)
        expect(total).toBeLessThanOrEqual(20)
      }),
    )
  })

  it('advantage is never lower than the worse die, and equals the better one', () => {
    fc.assert(
      fc.property(seed, (s) => {
        const r = roll('2d20kh1', { rng: seededRng(s) })
        const values = r.groups[0]!.dice.map((d) => d.value)
        expect(r.total).toBeGreaterThanOrEqual(Math.min(...values))
        expect(r.total).toBe(Math.max(...values))
      }),
    )
  })

  it('every die stays within its faces', () => {
    fc.assert(
      fc.property(
        seed,
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 20 }),
        (s, sides, count) => {
          const r = roll(`${count}d${sides}`, { rng: seededRng(s) })
          for (const d of r.groups[0]!.dice) {
            expect(d.value).toBeGreaterThanOrEqual(1)
            expect(d.value).toBeLessThanOrEqual(sides)
          }
        },
      ),
    )
  })
})

describe('distribution', () => {
  /**
   * 100 000 rolls of 2d20/2 (rounded up) with a fixed seed compared with the
   * exact distribution. Tolerance: 0.4 percentage point per value — about 5
   * standard deviations at this sample size, so the test never flakes but a
   * biased die or wrong rounding fails it immediately.
   */
  it('2d20/2 matches the theoretical distribution over 100 000 rolls', () => {
    const N = 100_000
    const rng = seededRng(20261011)
    const counts = new Array<number>(21).fill(0)
    for (let i = 0; i < N; i++) counts[roll('2d20/2', { rng }).total]!++

    for (let v = 1; v <= 20; v++) {
      // Sums s with ceil(s / 2) = v are 2v − 1 and 2v; P(sum = s) = (20 − |s − 21|) / 400.
      const expected = [2 * v - 1, 2 * v]
        .filter((s) => s >= 2 && s <= 40)
        .reduce((p, s) => p + (20 - Math.abs(s - 21)) / 400, 0)
      expect(Math.abs(counts[v]! / N - expected)).toBeLessThan(0.004)
    }
  })
})
