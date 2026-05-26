'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { defaultAgentToolNames, type SettingsUserDto, type ToolPolicyDto, type WorkspaceSettingsDto } from '../../../../contracts/types/businessFoundation'
import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import type { WorkbenchContext } from '@/modules/agent-copilot/types'
import { fetchActivityApi } from './api-client'

export function SettingsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceSettingsDto | null>(null)
  const [toolPolicy, setToolPolicy] = useState<ToolPolicyDto | null>(null)
  const [users, setUsers] = useState<SettingsUserDto[]>([])
  const [freshnessHours, setFreshnessHours] = useState(24)
  const [deniedRuntimeToolsText, setDeniedRuntimeToolsText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<{ href: string; label: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function loadSettings() {
    const [nextWorkspace, nextPolicy, nextUsers] = await Promise.all([
      fetchActivityApi<WorkspaceSettingsDto>('/api/settings/workspace'),
      fetchActivityApi<ToolPolicyDto>('/api/settings/tool-policy'),
      fetchActivityApi<SettingsUserDto[]>('/api/settings/users'),
    ])
    setWorkspace(nextWorkspace)
    setToolPolicy(nextPolicy)
    setUsers(nextUsers)
    setFreshnessHours(nextWorkspace.dataFreshnessThresholdHours)
    setDeniedRuntimeToolsText(nextPolicy.deniedRuntimeTools.join('\n'))
  }

  useEffect(() => {
    loadSettings().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '设置加载失败'))
  }, [])

  const allowedTools = useMemo(() => new Set(toolPolicy?.allowedAgentTools ?? workspace?.allowedAgentTools ?? []), [toolPolicy, workspace])
  const currentDeniedRuntimeTools = useMemo(() => toolPolicy?.deniedRuntimeTools ?? workspace?.deniedRuntimeTools ?? [], [toolPolicy, workspace])
  const agentContext = useMemo<WorkbenchContext>(() => ({
    route: '/settings',
    pageTitle: '系统设置',
    selectedEntity: {
      entityType: 'settings',
      entityId: workspace?.workspaceId ?? 'settings',
      label: workspace?.name ?? '系统设置',
    },
    visibleFilters: {
      freshnessHours,
      allowedToolCount: allowedTools.size,
      deniedRuntimeTools: currentDeniedRuntimeTools,
      settingsDraft: {
        dataFreshnessThresholdHours: freshnessHours,
        allowedAgentTools: Array.from(allowedTools),
        deniedRuntimeToolsText,
        deniedRuntimeTools: parseRuntimeToolList(deniedRuntimeToolsText),
      },
      activeUserCount: users.filter((user) => user.status === 'ACTIVE').length,
    },
    visibleColumns: ['workspace', 'toolPolicy', 'reviewUsers', 'workflowRunId'],
  }), [allowedTools, currentDeniedRuntimeTools, deniedRuntimeToolsText, freshnessHours, users, workspace?.name, workspace?.workspaceId])

  async function saveWorkspace() {
    setBusy('workspace')
    setActionLink(null)
    try {
      const updated = await fetchActivityApi<WorkspaceSettingsDto>('/api/settings/workspace', {
        method: 'PATCH',
        body: JSON.stringify({ dataFreshnessThresholdHours: freshnessHours }),
      })
      setWorkspace(updated)
      setFreshnessHours(updated.dataFreshnessThresholdHours)
      setMessage(`已更新数据新鲜度阈值：${updated.dataFreshnessThresholdHours} 小时`)
      setActionLink(settingsRunActionLink(updated.workflowRunId, '查看设置 Run'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '工作区设置保存失败')
    } finally {
      setBusy(null)
    }
  }

  async function toggleTool(toolName: string) {
    const nextAllowed = allowedTools.has(toolName)
      ? Array.from(allowedTools).filter((tool) => tool !== toolName)
      : [...Array.from(allowedTools), toolName]
    setBusy(`tool:${toolName}`)
    setActionLink(null)
    try {
      const updated = await fetchActivityApi<ToolPolicyDto>('/api/settings/tool-policy', {
        method: 'PATCH',
        body: JSON.stringify({ allowedAgentTools: nextAllowed, deniedRuntimeTools: currentDeniedRuntimeTools }),
      })
      setToolPolicy(updated)
      setDeniedRuntimeToolsText(updated.deniedRuntimeTools.join('\n'))
      setMessage(`已更新 Agent 工具策略：允许 ${updated.allowedAgentTools.length} 个工具`)
      setActionLink(settingsRunActionLink(updated.workflowRunId, '查看策略 Run'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '工具策略保存失败')
    } finally {
      setBusy(null)
    }
  }

  async function saveDeniedRuntimeTools() {
    const nextDeniedRuntimeTools = parseRuntimeToolList(deniedRuntimeToolsText)
    setBusy('denied-runtime-tools')
    setActionLink(null)
    try {
      const updated = await fetchActivityApi<ToolPolicyDto>('/api/settings/tool-policy', {
        method: 'PATCH',
        body: JSON.stringify({ allowedAgentTools: Array.from(allowedTools), deniedRuntimeTools: nextDeniedRuntimeTools }),
      })
      setToolPolicy(updated)
      setDeniedRuntimeToolsText(updated.deniedRuntimeTools.join('\n'))
      setMessage(`已更新 Runtime 禁用工具：${updated.deniedRuntimeTools.length} 个`)
      setActionLink(settingsRunActionLink(updated.workflowRunId, '查看策略 Run'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Runtime 禁用工具保存失败')
    } finally {
      setBusy(null)
    }
  }

  async function toggleUser(user: SettingsUserDto) {
    const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    setBusy(`user:${user.userId}`)
    setActionLink(null)
    try {
      const updated = await fetchActivityApi<SettingsUserDto>(`/api/settings/users/${user.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      setUsers((current) => current.map((item) => (item.userId === updated.userId ? updated : item)))
      setMessage(`已${updated.status === 'ACTIVE' ? '启用' : '停用'}审批角色：${updated.name}`)
      setActionLink(settingsRunActionLink(updated.workflowRunId, '查看角色 Run'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '审批角色更新失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
    <WorkbenchContextRegistration context={agentContext} />
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>系统设置</h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>管理工作区阈值、Agent 工具策略与审批角色。所有修改都会写入设置 API 并产生审计记录。</p>
          {message ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>
              {message}
              {actionLink ? <> · <a href={actionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{actionLink.label}</a></> : null}
            </p>
          ) : null}
        </div>
        <button className="secondaryButton" type="button" onClick={() => void loadSettings()} disabled={!!busy}>刷新</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)', gap: '24px' }}>
        <div className="panel">
          <div style={{ padding: '20px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '6px' }}>工作区</h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{workspace?.name ?? '加载中'} / tenant: {workspace?.defaultTenantId ?? '-'}</p>
          </div>
          <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
            <label style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
              数据新鲜度阈值（小时）
              <input value={freshnessHours} min={1} max={168} type="number" onChange={(event) => setFreshnessHours(Number(event.target.value))} style={{ height: '36px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px' }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <SettingStat label="高风险 SLA" value={`${workspace?.reviewSlaHours.high ?? '-'}h`} />
              <SettingStat label="中风险 SLA" value={`${workspace?.reviewSlaHours.medium ?? '-'}h`} />
              <SettingStat label="低风险 SLA" value={`${workspace?.reviewSlaHours.low ?? '-'}h`} />
            </div>
            <button className="primaryButton" type="button" onClick={() => void saveWorkspace()} disabled={busy === 'workspace'} style={{ width: 'fit-content' }}>保存工作区设置</button>
          </div>
        </div>

        <div className="panel">
          <div style={{ padding: '20px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '6px' }}>审批与角色</h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>来自 `/api/settings/users`</p>
          </div>
          <div style={{ padding: '12px 20px', display: 'grid', gap: '10px' }}>
            {users.map((user) => (
              <div key={user.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{user.teamName} / {user.role}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="statusBadge statusBadge--ready">{user.status}</span>
                  <button className="secondaryButton" type="button" onClick={() => void toggleUser(user)} disabled={busy === `user:${user.userId}`} style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}>{user.status === 'ACTIVE' ? '停用' : '启用'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '16px', marginBottom: '6px' }}>Agent 工具策略</h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>允许工具会影响 Chat 可调用的业务能力；敏感 runtime 工具始终强制禁用。</p>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>policy {toolPolicy?.policyVersion ?? '-'}</div>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {defaultAgentToolNames.map((toolName) => (
            <label key={toolName} style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', background: allowedTools.has(toolName) ? 'rgba(22, 163, 74, 0.06)' : 'white' }}>
              <input type="checkbox" checked={allowedTools.has(toolName)} disabled={busy === `tool:${toolName}`} onChange={() => void toggleTool(toolName)} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{toolName}</span>
            </label>
          ))}
        </div>
        <div style={{ padding: '0 20px 20px', display: 'grid', gap: '10px' }}>
          <label style={{ display: 'grid', gap: '8px', fontSize: '13px', color: 'var(--muted)' }}>
            Runtime 强制禁用工具（逗号或换行分隔）
            <textarea
              value={deniedRuntimeToolsText}
              onChange={(event) => setDeniedRuntimeToolsText(event.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical', border: '1px solid var(--line)', borderRadius: '6px', padding: '8px', font: 'inherit', color: 'var(--fg)' }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>当前生效：{currentDeniedRuntimeTools.join(', ') || '-'}</span>
            <button className="secondaryButton" type="button" onClick={() => void saveDeniedRuntimeTools()} disabled={busy === 'denied-runtime-tools'}>保存 Runtime 禁用</button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

function SettingStat({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '12px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{label}</div><div style={{ fontWeight: 700, fontSize: '18px', marginTop: '4px' }}>{value}</div></div>
}

function parseRuntimeToolList(value: string): string[] {
  return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)))
}

function settingsRunActionLink(workflowRunId: string | undefined, label: string): { href: string; label: string } {
  if (!workflowRunId) return { href: '/settings', label: '查看设置' }
  const params = new URLSearchParams({ runId: workflowRunId })
  return { href: `/run-console?${params.toString()}`, label }
}
