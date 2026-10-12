import { toast } from 'sonner'
import { campaignRepository, CampaignImportError, splitImportFile } from '@/db/campaigns'
import type { Campaign } from '@/db/types'
import { useT } from '@/i18n'
import type { Messages } from '@/i18n/locales/fr'
import { MAX_IMPORT_BYTES } from '@/db/sanitize'
import { downloadJson, slugify } from '@/lib/files'
import { flushAutosave, useCampaignStore } from '@/stores/campaignStore'
import { recordActivity } from '@/stores/activityLog'

export function importErrorMessage(t: Messages, error: unknown): string {
  if (!(error instanceof CampaignImportError)) return t.errors.generic
  switch (error.code) {
    case 'invalidJson':
      return t.importErrors.invalidJson
    case 'wrongFormat':
      return t.importErrors.wrongFormat
    case 'unsupportedVersion':
      return error.version === undefined
        ? t.importErrors.wrongFormat
        : t.importErrors.unsupportedVersion(error.version)
    case 'invalidCampaign':
      return t.importErrors.invalidCampaign
    case 'tooLarge':
      return t.importErrors.tooLarge
  }
}

/** Removes every `codex.*` key of localStorage (settings, last screens…). */
export function clearLocalPreferences(storage: Storage = localStorage): void {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith('codex.')) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
}

export function useCampaignActions() {
  const t = useT()

  return {
    async create(input: { name: string; description: string }): Promise<Campaign> {
      const campaign = await campaignRepository.create(input)
      toast.success(t.campaigns.created(campaign.name))
      return campaign
    },

    async update(id: string, input: { name: string; description: string }): Promise<void> {
      await campaignRepository.update(id, input)
      recordActivity(id, t.activity.campaign)
      toast.success(t.campaigns.renamed)
    },

    async remove(campaign: Campaign): Promise<void> {
      if (useCampaignStore.getState().campaignId === campaign.id)
        await useCampaignStore.getState().unload()
      await campaignRepository.remove(campaign.id)
      toast.success(t.campaigns.deleted(campaign.name))
    },

    async exportToFile(campaign: Campaign): Promise<void> {
      await flushAutosave()
      const data = await campaignRepository.exportCampaign(campaign.id)
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`codex-${slugify(campaign.name)}-${date}.json`, data)
      toast.success(t.campaigns.exported)
    },

    /** Imports a campaign file, or every campaign of an archive. Returns the last one imported. */
    async importFromFile(file: File): Promise<Campaign | null> {
      let last: Campaign | null = null
      try {
        if (file.size > MAX_IMPORT_BYTES) throw new CampaignImportError('tooLarge')
        const parts = splitImportFile(await file.text())
        for (const part of parts) {
          const { campaign, renamed } = await campaignRepository.importCampaign(
            part,
            t.campaigns.copySuffix,
          )
          last = campaign
          if (parts.length === 1)
            toast.success(
              renamed
                ? t.campaigns.importedAsCopy(campaign.name)
                : t.campaigns.imported(campaign.name),
            )
        }
        if (parts.length !== 1) toast.success(t.privacy.archiveImported(parts.length))
        return last
      } catch (error) {
        toast.error(importErrorMessage(t, error))
        return last
      }
    },

    /** GDPR portability: every campaign of this device in one file. */
    async exportAllToFile(): Promise<void> {
      await flushAutosave()
      const data = await campaignRepository.exportAll()
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`codex-archive-${date}.json`, data)
      toast.success(t.privacy.exported(data.campaigns.length))
    },

    /** GDPR erasure: the database and every preference kept on this device. */
    async eraseAll(): Promise<void> {
      await useCampaignStore.getState().unload()
      await campaignRepository.eraseAll()
      clearLocalPreferences()
      // Reload from the campaigns screen so no in-memory copy survives.
      window.location.hash = '#/'
      window.location.reload()
    },
  }
}
