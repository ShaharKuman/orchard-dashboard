import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OrchardAgent Dashboard',
  description: 'פרדסי לב — דשבורד ניהול',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
