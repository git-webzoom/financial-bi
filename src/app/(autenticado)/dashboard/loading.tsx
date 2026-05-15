export default function Loading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="h-6 w-32 rounded-lg" style={{ backgroundColor: '#1A1A1A' }} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl px-5 py-4 space-y-2" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
            <div className="h-3 w-20 rounded" style={{ backgroundColor: '#1A1A1A' }} />
            <div className="h-6 w-28 rounded" style={{ backgroundColor: '#1A1A1A' }} />
          </div>
        ))}
      </div>

      <div className="rounded-xl h-48" style={{ backgroundColor: '#111111', border: '1px solid #222222' }} />
    </div>
  )
}
