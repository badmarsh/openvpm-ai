import { type Metadata } from 'next'

import { TRPCReactProvider } from '@/trpc/react'

export const metadata: Metadata = {
  title: 'OpenVPM AI',
  description: 'Veterinary Practice Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  )
}