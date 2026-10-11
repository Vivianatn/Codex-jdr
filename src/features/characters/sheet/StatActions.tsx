import * as ContextMenu from '@radix-ui/react-context-menu'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Ellipsis } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '@/components/ui/Button'
import type { MenuEntry } from './statMenu'

const ITEM =
  'flex min-h-9 cursor-pointer items-center rounded-sm px-2.5 py-1.5 text-sm text-ink outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2'
const CONTENT = 'z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-overlay'

/** "⋯" button menu (keyboard-friendly twin of the context menu). */
export function StatMenuButton({ label, groups }: { label: string; groups: MenuEntry[][] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton label={label} icon={<Ellipsis />} size="sm" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={CONTENT}>
          {groups.map((group, i) => (
            <DropdownMenu.Group key={i}>
              {i > 0 && <DropdownMenu.Separator className="my-1 h-px bg-line" />}
              {group.map((entry) => (
                <DropdownMenu.Item
                  key={entry.label}
                  className={ITEM}
                  disabled={entry.disabled}
                  onSelect={entry.onSelect}
                >
                  {entry.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Right-click / long-press menu around any element. */
export function StatContextMenu({
  groups,
  children,
}: {
  groups: MenuEntry[][]
  children: ReactNode
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={CONTENT}>
          {groups.map((group, i) => (
            <ContextMenu.Group key={i}>
              {i > 0 && <ContextMenu.Separator className="my-1 h-px bg-line" />}
              {group.map((entry) => (
                <ContextMenu.Item
                  key={entry.label}
                  className={ITEM}
                  disabled={entry.disabled}
                  onSelect={entry.onSelect}
                >
                  {entry.label}
                </ContextMenu.Item>
              ))}
            </ContextMenu.Group>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
