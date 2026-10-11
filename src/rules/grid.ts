import type { RulesConfig } from './config'

export function cellsToMeters(cells: number, rules: RulesConfig): number {
  return cells * rules.grid.cellMeters
}
