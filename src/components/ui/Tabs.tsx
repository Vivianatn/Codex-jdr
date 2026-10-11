import * as RadixTabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Tabs = RadixTabs.Root

export function TabList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RadixTabs.List aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {children}
    </RadixTabs.List>
  )
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        '-mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors',
        'hover:text-ink data-[state=active]:border-accent data-[state=active]:text-accent-text [&>svg]:size-4',
      )}
    >
      {children}
    </RadixTabs.Trigger>
  )
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixTabs.Content value={value} className="pt-6 outline-none">
      {children}
    </RadixTabs.Content>
  )
}
