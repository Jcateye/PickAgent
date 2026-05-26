import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'

test('agent mission page starts, approves a review gate, pauses, and cancels real mission runs', async ({ page }) => {
  const stamp = Date.now()
  const objective = `页面 Mission 流转验收 ${stamp}`

  await page.goto(`${baseURL}/agent-mission`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Agent Mission（聊天式任务控制台）' })).toBeVisible()
  await expect(page.getByRole('button', { name: '启动 Mission' })).toBeEnabled()

  await page.getByLabel('Mission 目标').fill(objective)
  const missionResponse = page.waitForResponse((response) => response.url().endsWith('/api/agent/missions') && response.request().method() === 'POST')
  const runResponse = page.waitForResponse((response) => /\/api\/agent\/missions\/[^/]+\/runs$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '启动 Mission' }).click()

  const missionEnvelope = await (await missionResponse).json()
  const runEnvelope = await (await runResponse).json()
  expect(missionEnvelope.code).toBe('OK')
  expect(runEnvelope.code).toBe('OK')
  const missionId = missionEnvelope.data.mission.id
  const runId = runEnvelope.data.id ?? runEnvelope.data.runId
  expect(missionId).toBeTruthy()
  expect(runId).toBeTruthy()
  expect(runEnvelope.data.missionId).toBe(missionId)
  expect(runEnvelope.data.status).toBe('WAITING_REVIEW')
  await expect(page.getByText(new RegExp(`已启动 Mission：${escapeRegExp(missionId)}`))).toBeVisible()
  await expect(page.getByRole('link', { name: '查看新 Run' })).toHaveAttribute('href', `/run-console?runId=${runId}`)
  await expect(page).toHaveURL(new RegExp(`missionId=${escapeRegExp(missionId)}.*runId=${escapeRegExp(runId)}`))

  const runDetailResponse = await page.request.get(`${baseURL}/api/agent/runs/${runId}`)
  expect(runDetailResponse.ok()).toBeTruthy()
  const runDetailEnvelope = await runDetailResponse.json()
  expect(runDetailEnvelope.code).toBe('OK')
  expect(runDetailEnvelope.data.run.runId).toBe(runId)
  expect(runDetailEnvelope.data.reviewGates.some((gate) => gate.status === 'PENDING')).toBeTruthy()
  expect(runDetailEnvelope.data.mission.objective).toBe(objective)

  await expect(page.getByText(/需要确认：1 个 Review Gate 正在等待人工处理/)).toBeVisible()
  const approveResponse = page.waitForResponse((response) => /\/api\/agent\/review-gates\/[^/]+\/decision$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '批准任务' }).click()
  const approveEnvelope = await (await approveResponse).json()
  expect(approveEnvelope.code).toBe('OK')
  expect(approveEnvelope.data.gate.status).toBe('APPROVED')
  const continuationRunId = approveEnvelope.data.continuationRun.id ?? approveEnvelope.data.continuationRun.runId
  expect(continuationRunId).toBeTruthy()
  await expect(page.getByText(new RegExp(`已批准 1 个 Review Gate，继续 Run ${escapeRegExp(continuationRunId)}`))).toBeVisible()
  await expect(page.getByRole('link', { name: '查看继续 Run' })).toHaveAttribute('href', `/run-console?runId=${continuationRunId}`)

  const pauseResponse = page.waitForResponse((response) => response.url().endsWith(`/api/agent/runs/${continuationRunId}/pause`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '暂停任务' }).click()
  const pauseEnvelope = await (await pauseResponse).json()
  expect(pauseEnvelope.code).toBe('OK')
  expect(pauseEnvelope.data.status).toBe('PAUSED')
  await expect(page.getByText(`已暂停 Run：${continuationRunId}`)).toBeVisible()
  await expect(page.getByRole('link', { name: '查看暂停 Run' })).toHaveAttribute('href', `/run-console?runId=${continuationRunId}`)

  const cancelResponse = page.waitForResponse((response) => response.url().endsWith(`/api/agent/runs/${continuationRunId}/cancel`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '取消任务' }).click()
  const cancelEnvelope = await (await cancelResponse).json()
  expect(cancelEnvelope.code).toBe('OK')
  expect(cancelEnvelope.data.status).toBe('CANCELED')
  await expect(page.getByText(`已取消 Run：${continuationRunId}`)).toBeVisible()
  await expect(page.getByRole('link', { name: '查看取消 Run' })).toHaveAttribute('href', `/run-console?runId=${continuationRunId}`)
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
