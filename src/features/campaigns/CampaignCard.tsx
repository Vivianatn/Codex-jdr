import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { motion } from 'framer-motion'
import { Download, Ellipsis, Pencil, Trash } from 'lucide-react'
import { Link } from 'react-router'
import { IconButton } from '@/components/ui/Button'
import type { Campaign } from '@/db/types'
import { formatRelativeTime, useIntlLocale, useT } from '@/i18n'
import { cn } from '@/lib/cn'

const MENU_ITEM =
  'flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2 [&>svg]:size-4 [&>svg]:text-ink-muted'

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } },
}

export function CampaignCard({
  campaign,
  onRename,
  onExport,
  onDelete,
}: {
  campaign: Campaign
  onRename: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const t = useT()
  const intl = useIntlLocale()

  return (
    <motion.li variants={cardVariants} layout="position" className="group relative">
      <Link
        to={`/c/${campaign.id}`}
        className="flex h-full min-h-36 flex-col rounded-lg border border-line bg-surface p-5 shadow-soft transition-[box-shadow,transform,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-lifted"
      >
        <span className="pr-8 font-title text-[1.375rem] leading-snug font-semibold text-ink">
          {campaign.name}
        </span>
        {campaign.description && (
          <span className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{campaign.description}</span>
        )}
        <span className="mt-auto flex items-center gap-2 pt-4 text-xs text-ink-muted">
          <span className="size-1 rotate-45 bg-gold" aria-hidden />
          {campaign.lastOpenedAt
            ? t.campaigns.lastOpened(
                formatRelativeTime(campaign.lastOpenedAt, intl, t.time.justNow),
              )
            : t.campaigns.neverOpened}
        </span>
      </Link>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton
            label={`${t.common.moreActions} — ${campaign.name}`}
            icon={<Ellipsis />}
            size="sm"
            className="absolute top-3 right-3"
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-44 rounded-xl border border-line bg-surface-raised p-1 shadow-lifted"
          >
            <DropdownMenu.Item className={MENU_ITEM} onSelect={onRename}>
              <Pencil /> {t.common.rename}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={MENU_ITEM} onSelect={onExport}>
              <Download /> {t.campaigns.export}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item
              className={cn(MENU_ITEM, 'text-hp-text [&>svg]:text-hp-text')}
              onSelect={onDelete}
            >
              <Trash /> {t.common.delete}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </motion.li>
  )
}
