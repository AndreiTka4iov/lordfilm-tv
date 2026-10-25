import { notFound } from 'next/navigation'
import { SearchView } from '@/views/search'
import { HomeView } from '@/views/home'
import { sectionPaths, isSectionPath } from '@/shared/config'
export const dynamicParams = false
export function generateStaticParams() {
  return sectionPaths.map((section) => ({ section }))
}
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!isSectionPath(section)) notFound()
  return section === 'search' ? <SearchView /> : <HomeView section={section} />
}
