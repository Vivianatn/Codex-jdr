// One shared collator: `a.localeCompare(b, 'fr')` builds a new one on every call.
const collator = new Intl.Collator('fr')

/** French alphabetical order, for `Array.prototype.sort`. */
export const compareText: (a: string, b: string) => number = collator.compare
