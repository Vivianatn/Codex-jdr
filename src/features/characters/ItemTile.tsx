import type { Item } from '@/domain/types'
import { cn } from '@/lib/cn'
import { ITEM_ICON_COMPONENTS, itemIconKey, RARITY_FRAME } from './itemIcons'

/** Square picture of an item: its image, or its icon on a rarity-tinted background. */
export function ItemArt({ item, className }: { item: Item; className?: string }) {
  const Icon = ITEM_ICON_COMPONENTS[itemIconKey(item)]
  const rarity = RARITY_FRAME[item.rarity]
  return item.image ? (
    <img
      src={item.image}
      alt=""
      draggable={false}
      className={cn('size-full rounded-[inherit] object-cover', className)}
    />
  ) : (
    <span
      className={cn(
        'flex size-full items-center justify-center rounded-[inherit]',
        rarity.tint,
        className,
      )}
    >
      <Icon className={cn('size-1/2', rarity.text)} strokeWidth={1.75} aria-hidden />
    </span>
  )
}
