'use client'
import { useEffect, useRef, useState } from 'react'

export function useVisiblePosters(ready: boolean) {
  const listRef = useRef<HTMLUListElement>(null)
  const [visible, setVisible] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (!ready || !listRef.current) return
    const nodes =
      listRef.current.querySelectorAll<HTMLElement>('[data-poster-id]')
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible((current) => {
          const next = new Set(current)
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.posterId
            if (!id) continue
            if (entry.isIntersecting) next.add(id)
            else next.delete(id)
          }
          return next
        })
      },
      { rootMargin: '100px', threshold: 0 },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [ready])
  return { listRef, visible }
}
