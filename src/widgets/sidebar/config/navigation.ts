import {
  IconSearch,
  IconHome,
  IconMovie,
  IconDeviceTvOld,
  IconMoodKid,
  IconSparkles,
  IconDeviceTv,
  IconChartBar,
  IconTrophy,
  IconHelpCircle,
  IconLogin2,
  IconUserPlus,
} from '@tabler/icons-react'
import { messages } from '@/shared/locales'
export const mainItems = [
  { href: '/search/', label: messages.navigation.search, icon: IconSearch },
  { href: '/', label: messages.navigation.home, icon: IconHome },
  { href: '/movies/', label: messages.navigation.movies, icon: IconMovie },
  {
    href: '/series/',
    label: messages.navigation.series,
    icon: IconDeviceTvOld,
  },
  {
    href: '/cartoons/',
    label: messages.navigation.cartoons,
    icon: IconMoodKid,
  },
  { href: '/anime/', label: messages.navigation.anime, icon: IconSparkles },
  { href: '/tv/', label: messages.navigation.tv, icon: IconDeviceTv },
  { href: '/top100/', label: messages.navigation.top100, icon: IconChartBar },
  { href: '/arena/', label: messages.navigation.arena, icon: IconTrophy },
] as const
export const accountItems = [
  { href: '/help/', label: messages.navigation.help, icon: IconHelpCircle },
  {
    href: '/sign-in/',
    label: messages.navigation['sign-in'],
    icon: IconLogin2,
  },
  {
    href: '/sign-up/',
    label: messages.navigation['sign-up'],
    icon: IconUserPlus,
  },
] as const
export type NavigationItem =
  (typeof mainItems)[number] | (typeof accountItems)[number]
