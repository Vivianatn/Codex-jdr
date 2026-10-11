import { toast } from 'sonner'
import { campaignRepository, CampaignImportError } from '@/db/campaigns'
import type { Campaign } from '@/db/types'
import { useT } from '@/i18n'
import type { Messages } from '@/i18n/locales/fr'
import { downloadJson, slugify } from '@/lib/files'

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
  }
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
      toast.success(t.campaigns.renamed)
    },

    async remove(campaign: Campaign): Promise<void> {
      await campaignRepository.remove(campaign.id)
      toast.success(t.campaigns.deleted(campaign.name))
    },

    async exportToFile(campaign: Campaign): Promise<void> {
      const data = await campaignRepository.exportCampaign(campaign.id)
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`codex-${slugify(campaign.name)}-${date}.json`, data)
      toast.success(t.campaigns.exported)
    },

    async importFromFile(file: File): Promise<Campaign | null> {
      try {
        const { campaign, renamed } = await campaignRepository.importCampaign(
          await file.text(),
          t.campaigns.copySuffix,
        )
        toast.success(
          renamed ? t.campaigns.importedAsCopy(campaign.name) : t.campaigns.imported(campaign.name),
        )
        return campaign
      } catch (error) {
        toast.error(importErrorMessage(t, error))
        return null
      }
    },
  }
}
