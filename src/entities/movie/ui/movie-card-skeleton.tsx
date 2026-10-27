import { Skeleton } from '@mantine/core'

/** The loading shape of a poster card; it has no actions until a movie exists. */
export function MovieCardSkeleton() {
  return (
    <Skeleton
      aria-hidden="true"
      radius="lg"
      className="aspect-[2/3] w-full motion-reduce:after:animate-none"
    />
  )
}
