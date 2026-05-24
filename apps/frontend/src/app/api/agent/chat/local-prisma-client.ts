import { PrismaPg } from '@prisma/adapter-pg'

import { assertAgentConversationPrismaClient, type AgentConversationPrismaClient } from '../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import { PrismaClient } from '../../../../../../backend/src/generated/prisma/client'

export interface LocalPrismaClientResult {
  client?: AgentConversationPrismaClient
  missing?: string
}

export function createLocalPrismaConversationClient(env: Record<string, string | undefined> = process.env): LocalPrismaClientResult {
  const connectionString = env.DATABASE_URL?.trim()
  if (!connectionString) return { missing: 'DATABASE_URL' }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
  assertAgentConversationPrismaClient(client)
  return { client }
}
