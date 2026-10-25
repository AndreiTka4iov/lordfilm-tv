import type { ReactNode } from 'react'
import { AppShell } from '@/widgets/app-shell'
import { PageHeader } from '@/widgets/page-header'
import { Sidebar } from '@/widgets/sidebar'
export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell sidebar={<Sidebar />} header={<PageHeader />}>
      {children}
    </AppShell>
  )
}
