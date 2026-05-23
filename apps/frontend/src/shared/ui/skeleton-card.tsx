interface SkeletonCardProps {
  lines?: number
}

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <div className="skeletonCard" aria-hidden="true">
      <div className="skeletonLine skeletonLine--title" />
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="skeletonLine" />
      ))}
    </div>
  )
}
