export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="h-6 w-16 rounded-lg" style={{ backgroundColor: '#1A1A1A' }} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl px-5 py-4 space-y-2" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
            <div className="h-3 w-20 rounded" style={{ backgroundColor: '#1A1A1A' }} />
            <div className="h-6 w-16 rounded" style={{ backgroundColor: '#1A1A1A' }} />
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-3 h-10" style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#0D0D0D' }} />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="px-5 py-3 flex gap-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
            <div className="h-4 w-32 rounded" style={{ backgroundColor: '#1A1A1A' }} />
            <div className="h-4 w-40 rounded" style={{ backgroundColor: '#1A1A1A' }} />
            <div className="h-4 w-20 rounded" style={{ backgroundColor: '#1A1A1A' }} />
            <div className="h-4 w-16 rounded ml-auto" style={{ backgroundColor: '#1A1A1A' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
