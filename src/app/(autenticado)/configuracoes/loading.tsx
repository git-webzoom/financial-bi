export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="h-6 w-32 rounded-lg" style={{ backgroundColor: '#1A1A1A' }} />

      {/* Abas */}
      <div className="flex gap-4 border-b" style={{ borderColor: '#1E1E1E' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded" style={{ backgroundColor: '#1A1A1A' }} />
        ))}
      </div>

      {/* Cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl px-5 py-4 space-y-3" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: '#1A1A1A' }} />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded" style={{ backgroundColor: '#1A1A1A' }} />
              <div className="h-3 w-20 rounded" style={{ backgroundColor: '#1A1A1A' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
