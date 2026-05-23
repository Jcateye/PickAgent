interface SkeletonTableProps {
  rows?: number
  columns?: number
}

export function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  return (
    <div className="skeletonTable" aria-hidden="true">
      <div className="skeletonTableRow" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className="skeletonCell skeletonCell--head" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="skeletonTableRow"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <div key={columnIndex} className="skeletonCell" />
          ))}
        </div>
      ))}
    </div>
  )
}
