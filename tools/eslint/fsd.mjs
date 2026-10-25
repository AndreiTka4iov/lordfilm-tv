import path from 'node:path'

const ranks = {
  app: 0,
  core: 0,
  views: 1,
  widgets: 2,
  features: 3,
  entities: 4,
  shared: 5,
}
function location(filename) {
  const parts = filename.replaceAll('\\', '/').split('/src/').at(-1).split('/')
  return { layer: parts[0], slice: parts[1], parts }
}
export const fsdRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      direction: 'FSD: imports must point to a lower layer.',
      sibling: 'FSD: compose sibling slices on a higher layer.',
      public: 'FSD: import another slice through its public index.ts.',
      self: 'FSD: use relative imports inside the current slice, without its own barrel.',
      outside: 'FSD: src must not depend on modules outside src.',
    },
  },
  create(context) {
    const sourceFile = context.filename.replaceAll('\\', '/')
    if (!sourceFile.includes('/src/')) return {}
    const from = location(sourceFile)
    if (!(from.layer in ranks)) return {}
    function check(node) {
      const specifier = node.source?.value
      if (typeof specifier !== 'string') return
      const internal = specifier.startsWith('@/') || specifier.startsWith('.')
      if (!internal) return
      const srcRoot = sourceFile.slice(0, sourceFile.indexOf('/src/') + 5)
      const resolved = specifier.startsWith('@/')
        ? srcRoot + specifier.slice(2)
        : path.resolve(path.dirname(sourceFile), specifier)
      if (!resolved.startsWith(srcRoot)) {
        context.report({ node, messageId: 'outside' })
        return
      }
      const to = location(resolved)
      if (!(to.layer in ranks)) return
      const sameSlice = from.layer === to.layer && from.slice === to.slice
      if (ranks[to.layer] < ranks[from.layer]) {
        context.report({ node, messageId: 'direction' })
        return
      }
      if (sameSlice) {
        const isBarrel =
          to.parts.length === 2 ||
          /^index(?:\.[cm]?[jt]sx?)?$/.test(to.parts[2] ?? '')
        if (specifier.startsWith('@/') || isBarrel)
          context.report({ node, messageId: 'self' })
        return
      }
      if (
        from.layer === to.layer &&
        !['app', 'core', 'shared'].includes(from.layer)
      ) {
        context.report({ node, messageId: 'sibling' })
        return
      }
      if (
        ['app', 'core'].includes(from.layer) &&
        ['app', 'core'].includes(to.layer)
      )
        return
      if (
        ['views', 'widgets', 'features', 'entities', 'shared'].includes(
          to.layer,
        ) &&
        (to.parts.length > 3 ||
          (to.parts.length === 3 &&
            !/^index(?:\.[cm]?[jt]sx?)?$/.test(to.parts[2])))
      ) {
        context.report({ node, messageId: 'public' })
      }
    }
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression(node) {
        check({ ...node, source: node.source })
      },
    }
  },
}
