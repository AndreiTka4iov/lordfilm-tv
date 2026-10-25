import { RuleTester } from 'eslint'
import { fsdRule } from '../tools/eslint/fsd.mjs'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})
const file = (p) => `/project/src/${p}`
tester.run('fsd', fsdRule, {
  valid: [
    {
      filename: file('views/home/ui/page.ts'),
      code: "import { A } from '@/widgets/app-shell'",
    },
    {
      filename: file('features/search/ui/search.ts'),
      code: "import { a } from '../model/state'",
    },
    {
      filename: file('features/search/index.ts'),
      code: "export { A } from './ui/search'",
    },
    {
      filename: file('shared/ui/button/ui/button.ts'),
      code: "import { a } from '@/shared/config'",
    },
    {
      filename: file('app/layout.ts'),
      code: "import { a } from '@/core/providers'",
    },
  ],
  invalid: [
    {
      filename: file('shared/config/a.ts'),
      code: "import { A } from '@/features/search'",
      errors: [{ messageId: 'direction' }],
    },
    {
      filename: file('features/search/ui/search.ts'),
      code: "import { A } from '@/features/favourites'",
      errors: [{ messageId: 'sibling' }],
    },
    {
      filename: file('views/home/ui/page.ts'),
      code: "import { A } from '@/widgets/app-shell/ui/app-shell'",
      errors: [{ messageId: 'public' }],
    },
    {
      filename: file('features/search/ui/search.ts'),
      code: "import { A } from '../../favourites'",
      errors: [{ messageId: 'sibling' }],
    },
    {
      filename: file('views/home/ui/page.ts'),
      code: "export * from '../../../widgets/app-shell/ui/app-shell'",
      errors: [{ messageId: 'public' }],
    },
    {
      filename: file('views/home/ui/page.ts'),
      code: "import('@/features/search/ui/search')",
      errors: [{ messageId: 'public' }],
    },
    {
      filename: file('features/search/ui/search.ts'),
      code: "import { A } from '@/features/search'",
      errors: [{ messageId: 'self' }],
    },
    {
      filename: file('features/search/ui/search.ts'),
      code: "import { A } from '../index'",
      errors: [{ messageId: 'self' }],
    },
    {
      filename: file('shared/config/a.ts'),
      code: "import { A } from '../../../tools/a'",
      errors: [{ messageId: 'outside' }],
    },
  ],
})
