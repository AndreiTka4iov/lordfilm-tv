import { Skeleton, Stack } from '@mantine/core'

/** The loading shape of a poster card; it has no actions until a movie exists. */
export function MovieCardSkeleton() {
  return (
    <Stack gap="sm" aria-hidden="true">
      <Skeleton
        radius="lg"
        className="aspect-[2/3] w-full motion-reduce:after:animate-none"
      />
      <Skeleton
        height={15}
        width="78%"
        radius="sm"
        className="motion-reduce:after:animate-none"
      />
      <Skeleton
        height={11}
        width="48%"
        radius="sm"
        className="motion-reduce:after:animate-none"
      />
    </Stack>
  )
}
