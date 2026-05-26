import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'

test('settings page persists workspace, tool policy, runtime denylist, and reviewer status through real APIs', async ({ page }) => {
  await page.goto(`${baseURL}/settings`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()

  const workspaceInput = page.getByLabel('数据新鲜度阈值（小时）')
  const originalFreshness = Number(await workspaceInput.inputValue())
  const nextFreshness = originalFreshness === 13 ? 14 : 13
  await workspaceInput.fill(String(nextFreshness))
  const workspaceResponse = page.waitForResponse((response) => response.url().endsWith('/api/settings/workspace') && response.request().method() === 'PATCH')
  await page.getByRole('button', { name: '保存工作区设置' }).click()
  const workspaceEnvelope = await (await workspaceResponse).json()
  expect(workspaceEnvelope.code).toBe('OK')
  expect(workspaceEnvelope.data.dataFreshnessThresholdHours).toBe(nextFreshness)
  expect(workspaceEnvelope.data.workflowRunId).toBeTruthy()
  await expect(page.getByText(`已更新数据新鲜度阈值：${nextFreshness} 小时`)).toBeVisible()
  await expect(page.getByRole('link', { name: '查看设置 Run' })).toBeVisible()

  const firstTool = page.locator('label', { hasText: 'getSkuSummary' }).first()
  const toolCheckbox = firstTool.locator('input[type="checkbox"]')
  const wasChecked = await toolCheckbox.isChecked()
  const toolPolicyResponse = page.waitForResponse((response) => response.url().endsWith('/api/settings/tool-policy') && response.request().method() === 'PATCH')
  await toolCheckbox.click()
  const toolPolicyEnvelope = await (await toolPolicyResponse).json()
  expect(toolPolicyEnvelope.code).toBe('OK')
  expect(toolPolicyEnvelope.data.allowedAgentTools.includes('getSkuSummary')).toBe(!wasChecked)
  expect(toolPolicyEnvelope.data.workflowRunId).toBeTruthy()
  await expect(page.getByText(/已更新 Agent 工具策略/)).toBeVisible()

  const deniedRuntimeTools = page.getByLabel('Runtime 强制禁用工具（逗号或换行分隔）')
  await deniedRuntimeTools.fill('browserUse\nshellExec')
  const deniedPolicyResponse = page.waitForResponse((response) => response.url().endsWith('/api/settings/tool-policy') && response.request().method() === 'PATCH')
  await page.getByRole('button', { name: '保存 Runtime 禁用' }).click()
  const deniedPolicyEnvelope = await (await deniedPolicyResponse).json()
  expect(deniedPolicyEnvelope.code).toBe('OK')
  expect(deniedPolicyEnvelope.data.deniedRuntimeTools).toEqual(expect.arrayContaining(['browserUse', 'shellExec']))
  expect(deniedPolicyEnvelope.data.workflowRunId).toBeTruthy()
  await expect(page.getByText(`已更新 Runtime 禁用工具：${deniedPolicyEnvelope.data.deniedRuntimeTools.length} 个`)).toBeVisible()

  const userButton = page.getByRole('button', { name: /停用|启用/ }).first()
  const userActionName = await userButton.innerText()
  const userResponse = page.waitForResponse((response) => /\/api\/settings\/users\/[^/]+$/.test(new URL(response.url()).pathname) && response.request().method() === 'PATCH')
  await userButton.click()
  const userEnvelope = await (await userResponse).json()
  expect(userEnvelope.code).toBe('OK')
  expect(userEnvelope.data.status).toBe(userActionName.includes('停用') ? 'DISABLED' : 'ACTIVE')
  expect(userEnvelope.data.workflowRunId).toBeTruthy()
  await expect(page.getByText(new RegExp(`已${userEnvelope.data.status === 'ACTIVE' ? '启用' : '停用'}审批角色`))).toBeVisible()
  await expect(page.getByRole('link', { name: '查看角色 Run' })).toBeVisible()
})
