export const sectionPaths = [
  'search',
  'movies',
  'series',
  'cartoons',
  'anime',
  'tv',
  'top100',
  'arena',
  'help',
  'sign-in',
  'sign-up',
] as const
export type SectionPath = (typeof sectionPaths)[number]
export function isSectionPath(value: string): value is SectionPath {
  return sectionPaths.some((section) => section === value)
}
