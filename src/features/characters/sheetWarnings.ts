import type { SheetWarning } from '@/domain/discord'
import type { Messages } from '@/i18n/locales/fr'

/** French message for a Discord import warning. */
export function warningText(t: Messages, w: SheetWarning): string {
  switch (w.code) {
    case 'notASheet':
      return t.discordImport.warnings.notASheet
    case 'missingName':
      return t.discordImport.warnings.missingName
    case 'missingStat':
      return t.discordImport.warnings.missingStat(t.stats.names[w.stat])
    case 'missingHp':
      return t.discordImport.warnings.missingHp
    case 'hpRollOutOfRange':
      return t.discordImport.warnings.hpRollOutOfRange(w.roll)
    case 'unknownSkillKind':
      return t.discordImport.warnings.unknownSkillKind(w.name)
  }
}
