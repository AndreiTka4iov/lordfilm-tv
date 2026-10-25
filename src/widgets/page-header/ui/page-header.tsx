import { Text } from '@mantine/core'
import { CatalogSearch } from '@/features/catalog-search'
import { appConfig } from '@/shared/config'
export function PageHeader() {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5 py-8">
      <div className="flex min-w-0 max-w-3xl">
        <CatalogSearch />
      </div>
      <Text
        fw={750}
        fz="xl"
        className="whitespace-nowrap pt-2.5 tracking-tight"
      >
        {appConfig.name}
      </Text>
    </header>
  )
}
