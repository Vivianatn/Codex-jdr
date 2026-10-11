import { DiceSyntaxError } from '@/dice'
import type { Messages } from '@/i18n/locales/fr'

/** French message for an invalid dice expression. */
export function diceErrorMessage(t: Messages, error: unknown): string {
  if (!(error instanceof DiceSyntaxError)) return t.errors.generic
  const e = t.dice.errors
  switch (error.code) {
    case 'empty':
      return e.empty
    case 'tooLong':
      return e.tooLong
    case 'unexpected':
      return e.unexpected(error.found, error.position + 1)
    case 'unexpectedEnd':
      return e.unexpectedEnd
    case 'missingParen':
      return e.missingParen
    case 'tooManyDice':
      return e.tooManyDice
    case 'badSides':
      return e.badSides
    case 'badKeep':
      return e.badKeep
    case 'noDice':
      return e.noDice
  }
}
