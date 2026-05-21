export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="h-6 w-24 rounded-lg" style={{ backgroundColor: '#1A1A1A' }} />

      {/* Abas */}
      <div className="flex gap-4 border-b" style={{ borderColor: '#1E1E1E' }}>
        <div className="h-8 w-20 rounded" style={{ backgroundColor: '#1A1A1A' }} />
        <div className="h-8 w-16 rounded" style={{ backgroundColor: '#1A1A1A' }} />
      </div>

      {/* Busca */}
      <div className="h-10 w-64 rounded-lg" style={{ backgroundColor: '#111111', border: '1px solid #222222' }} />

      {/* Tabela */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-3 h-10" style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#0D0D0D' }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-5 py-3 flex gap-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
            <div className="h-4 w-48 rounded" style={{ backgroundColor: '#1A1A1A' }} />
            <div className="h-4 w-24 rounded" style={{ backgroundColor: '#1A1A1A' }} />
            <div className="h-4 w-16 rounded ml-auto" style={{ backgroundColor: '#1A1A1A' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
