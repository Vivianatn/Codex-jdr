import * as RadixTabs from '@radix-ui/react-tabs'
import { motion } from 'framer-motion'
import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const TabsState = createContext<{ value: string; underline: string } | null>(null)

/** Tabs (DA §8.7); the active underline slides from one tab to the next. */
export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  className?: string
}) {
  const [inner, setInner] = useState(defaultValue ?? '')
  const value = controlled ?? inner
  const underline = useId()
  return (
    <TabsState.Provider value={{ value, underline }}>
      <RadixTabs.Root
        value={value}
        onValueChange={(v) => {
          setInner(v)
          onValueChange?.(v)
        }}
        className={className}
      >
        {children}
      </RadixTabs.Root>
    </TabsState.Provider>
  )
}

export function TabList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RadixTabs.List
      aria-label={label}
      className="flex [scrollbar-width:thin] gap-6 overflow-x-auto border-b border-line"
    >
      {children}
    </RadixTabs.List>
  )
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const state = useContext(TabsState)
  const active = state?.value === value
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        'relative inline-flex items-center gap-2 py-3 text-[0.9375rem] whitespace-nowrap transition-colors [&>svg]:size-4',
        active ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink',
      )}
    >
      {children}
      {active && (
        <motion.span
          layoutId={state?.underline}
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      )}
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
