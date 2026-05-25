'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { SettingsUserDto, ToolPolicyDto, WorkspaceSettingsDto } from '../../../../contracts/types/businessFoundation'
import { fetchActivityApi } from './api-client'

const commonAgentTools = [
  'getDashboardContext',
  'searchSkus',
  'listRuleSets',
  'listActivities',
  'getSkuSummary',
  'diagnoseSkuHealth',
  'checkDataFreshness',
  'parseActivityRules',
  'simulateActivityReadiness',
  'createReviewItems',
  'generateReportPreview',
  'listConnectors',
  'runConnectorSync',
  'listReports',
  'exportReport',
  'subscribeReport',
  'setSkuNextAction',
]

export function SettingsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceSettingsDto | null>(null)
  const [toolPolicy, setToolPolicy] = useState<ToolPolicyDto | null>(null)
  const [users, setUsers] = useState<SettingsUserDto[]>([])
  const [freshnessHours, setFreshnessHours] = useState(24)
  const [message, setMessage] = useState<string | null>(null)
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
  }

  useEffect(() => {
    loadSettings().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '设置加载失败'))
  }, [])

  const allowedTools = useMemo(() => new Set(toolPolicy?.allowedAgentTools ?? workspace?.allowedAgentTools ?? []), [toolPolicy, workspace])

  async function saveWorkspace() {
    setBusy('workspace')
    try {
      const updated = await fetchActivityApi<WorkspaceSettingsDto>('/api/settings/workspace', {
        method: 'PATCH',
        body: JSON.stringify({ dataFreshnessThresholdHours: freshnessHours }),
      })
      setWorkspace(updated)
      setFreshnessHours(updated.dataFreshnessThresholdHours)
      setMessage(`已更新数据新鲜度阈值：${updated.dataFreshnessThresholdHours} 小时`)
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
    try {
      const updated = await fetchActivityApi<ToolPolicyDto>('/api/settings/tool-policy', {
        method: 'PATCH',
        body: JSON.stringify({ allowedAgentTools: nextAllowed, deniedRuntimeTools: toolPolicy?.deniedRuntimeTools ?? workspace?.deniedRuntimeTools ?? [] }),
      })
      setToolPolicy(updated)
      setMessage(`已更新 Agent 工具策略：允许 ${updated.allowedAgentTools.length} 个工具`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '工具策略保存失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>系统设置</h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>管理工作区阈值、Agent 工具策略与审批角色。所有修改都会写入设置 API 并产生审计记录。</p>
          {message ? <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>{message}</p> : null}
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
                <span className="statusBadge statusBadge--ready">{user.status}</span>
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
          {commonAgentTools.map((toolName) => (
            <label key={toolName} style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', background: allowedTools.has(toolName) ? 'rgba(22, 163, 74, 0.06)' : 'white' }}>
              <input type="checkbox" checked={allowedTools.has(toolName)} disabled={busy === `tool:${toolName}`} onChange={() => void toggleTool(toolName)} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{toolName}</span>
            </label>
          ))}
        </div>
        <div style={{ padding: '0 20px 20px', color: 'var(--muted)', fontSize: '13px' }}>
          强制禁用：{(toolPolicy?.deniedRuntimeTools ?? workspace?.deniedRuntimeTools ?? []).join(', ') || '-'}
        </div>
      </div>
    </div>
  )
}

function SettingStat({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '12px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{label}</div><div style={{ fontWeight: 700, fontSize: '18px', marginTop: '4px' }}>{value}</div></div>
}
