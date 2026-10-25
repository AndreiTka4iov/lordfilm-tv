import Link from 'next/link'
import { UnstyledButton } from '@mantine/core'
import type { NavigationItem } from '../config/navigation'

type Props = {
  item: NavigationItem
  active: boolean
  expanded: boolean
  onHint: (label: string) => void
}
export function NavigationLink({ item, active, expanded, onHint }: Props) {
  const Icon = item.icon
  return (
    <UnstyledButton
      component={Link}
      href={item.href}
      prefetch={false}
      scroll={false}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      data-nav-item
      data-active={active}
      onMouseEnter={() => {
        if (!expanded) onHint(item.label)
      }}
      onMouseLeave={() => onHint('')}
      className="group relative flex h-12 min-h-12 [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:min-h-8 w-full items-center gap-4 overflow-hidden rounded-2xl px-4 text-[var(--mantine-color-text)] transition-[background-color,color,transform] duration-150 hover:bg-black/5 focus-visible:bg-[var(--mantine-color-dark-9)]! focus-visible:text-white! focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--mantine-color-dark-9)] data-[active=true]:bg-accent/12 motion-reduce:transition-none [[data-mantine-color-scheme=dark]_&]:hover:bg-white/7 [[data-mantine-color-scheme=dark]_&]:data-[active=true]:text-accent [[data-mantine-color-scheme=dark]_&]:focus-visible:bg-white! [[data-mantine-color-scheme=dark]_&]:focus-visible:text-black! [[data-mantine-color-scheme=dark]_&]:focus-visible:outline-white"
    >
      <Icon size={25} stroke={1.7} aria-hidden className="shrink-0" />
      <span
        aria-hidden
        className={
          expanded
            ? 'whitespace-nowrap text-[15px] font-medium opacity-100 transition-opacity duration-150 motion-reduce:transition-none'
            : 'pointer-events-none whitespace-nowrap text-[15px] font-medium opacity-0'
        }
      >
        {item.label}
      </span>
      {active && (
        <span
          aria-hidden
          className={
            expanded
              ? 'ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-current'
              : 'hidden'
          }
        />
      )}
    </UnstyledButton>
  )
}
