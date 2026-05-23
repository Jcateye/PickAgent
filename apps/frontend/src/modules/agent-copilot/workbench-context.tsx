'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import type { PropsWithChildren } from 'react'

import type { WorkbenchContext } from './types'

interface WorkbenchContextRegistryValue {
  context: WorkbenchContext
  setContext: (context: WorkbenchContext) => void
}

const defaultContext: WorkbenchContext = {
  route: '/dashboard',
  pageTitle: 'Dashboard 总览',
  selectedEntity: { entityType: 'dashboard', entityId: 'dashboard', label: 'Dashboard 总览' },
  visibleFilters: {},
  visibleColumns: ['status', 'risk', 'nextAction'],
}

const WorkbenchContextRegistry = createContext<WorkbenchContextRegistryValue | null>(null)

export function WorkbenchContextProvider({ children, value }: PropsWithChildren<{ value: WorkbenchContextRegistryValue }>) {
  return <WorkbenchContextRegistry.Provider value={value}>{children}</WorkbenchContextRegistry.Provider>
}

export function WorkbenchContextRegistration({ context }: { context: WorkbenchContext }) {
  const registry = useContext(WorkbenchContextRegistry)
  const previousKey = useRef<string | null>(null)

  useEffect(() => {
    const key = JSON.stringify(context)
    if (previousKey.current === key) return
    previousKey.current = key
    registry?.setContext(context)
  }, [context, registry])

  return null
}

export function useWorkbenchContext(): WorkbenchContext {
  return useContext(WorkbenchContextRegistry)?.context ?? defaultContext
}
