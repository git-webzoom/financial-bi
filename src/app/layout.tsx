import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sistema BI',
  description: 'Financial Business Intelligence',
}

// Cara de app no mobile: viewport ajustado ao device + barra de status escura
// integrada ao fundo (#0A0A0A). viewportFit=cover usa a tela toda em devices com notch.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
