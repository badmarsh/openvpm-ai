import { createTRPCReact, httpBatchLink } from '@trpc/react-query'
import type { AppRouter } from '@openpims/api'

export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> = createTRPCReact<AppRouter>()

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  return children
}