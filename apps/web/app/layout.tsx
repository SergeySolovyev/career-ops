import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CareerPilot — AI найдёт работу за вас',
  description: 'Загрузите CV — система 24/7 сканирует вакансии, оценивает AI, генерирует tailored CV и откликается автоматически.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
