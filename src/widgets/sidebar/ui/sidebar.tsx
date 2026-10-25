'use client'
import { usePathname } from 'next/navigation'
import { Box, Divider } from '@mantine/core'
import { IconPlayerPlayFilled } from '@tabler/icons-react'
import { messages } from '@/shared/locales'
import { mainItems, accountItems } from '../config/navigation'
import { useSidebar } from '../model/use-sidebar'
import { NavigationLink } from './navigation-link'

export function Sidebar() {
  const pathname = usePathname()
  const { expanded, hint, setHint, rootRef, onBlur, onKeyDown, onFocus } =
    useSidebar()
  const groups = [mainItems, accountItems]
  return (
    <>
      <Box
        component="aside"
        ref={rootRef}
        data-sidebar
        data-expanded={expanded}
        aria-label={messages.navigation.menu}
        onFocusCapture={onFocus}
        onBlurCapture={onBlur}
        onKeyDown={onKeyDown}
        className="fixed inset-y-4 left-3 z-30 flex w-[82px] flex-col overflow-hidden rounded-[28px] border border-black/6 bg-[var(--mantine-color-gray-0)]/95 p-3 backdrop-blur-xl transition-[width] duration-200 ease-out data-[expanded=true]:w-[264px] motion-reduce:transition-none sm:left-5 [[data-mantine-color-scheme=dark]_&]:border-white/8 [[data-mantine-color-scheme=dark]_&]:bg-[var(--mantine-color-dark-8)]/95"
      >
        <div className="mb-3 flex h-14 min-h-14 [@media(max-height:700px)]:mb-2 [@media(max-height:700px)]:h-10 [@media(max-height:700px)]:min-h-10 items-center gap-3 overflow-hidden px-3">
          <IconPlayerPlayFilled
            size={29}
            aria-hidden
            className="shrink-0 text-accent"
          />
          <span
            aria-hidden={!expanded}
            className={
              expanded
                ? 'whitespace-nowrap text-lg font-bold tracking-tight'
                : 'sr-only'
            }
          >
            LordFilm{' '}
            <span className="font-normal text-[var(--mantine-color-dimmed)]">
              TV
            </span>
          </span>
        </div>
        <nav
          aria-label={messages.navigation.menu}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none]"
        >
          {groups.map((items, group) => (
            <div
              key={group}
              className={
                group === 1
                  ? 'mt-auto pt-3 [@media(max-height:700px)]:pt-2'
                  : 'flex flex-col gap-1 [@media(max-height:700px)]:gap-0.5'
              }
            >
              {group === 1 && (
                <Divider mb="sm" color="var(--mantine-color-default-border)" />
              )}
              {items.map((item) => (
                <NavigationLink
                  key={item.href}
                  item={item}
                  active={
                    pathname === item.href || pathname + '/' === item.href
                  }
                  expanded={expanded}
                  onHint={setHint}
                />
              ))}
            </div>
          ))}
        </nav>
      </Box>
      {hint && !expanded && (
        <div
          role="tooltip"
          className="pointer-events-none fixed bottom-5 left-28 z-40 rounded-xl bg-[var(--mantine-color-dark-6)] px-4 py-2 text-sm text-white"
        >
          {hint}
        </div>
      )}
    </>
  )
}
