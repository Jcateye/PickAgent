import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'
const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'playwright_run_console_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'playwright_run_console_session',
  'x-p0-surface': 'playwright-run-console-test',
  'x-request-id': 'playwright_run_console_request',
}

async function apiPost(request, path, body) {
  const response = await request.post(`${baseURL}${path}`, {
    headers: authHeaders,
    data: body,
  })
  expect(response.ok()).toBeTruthy()
  const envelope = await response.json()
  expect(envelope.code).toBe('OK')
  return envelope.data
}

test('run console page restores a real workflow run, exports logs, switches tabs, and guards non-failed retries', async ({ page }) => {
  const stamp = Date.now()
  const ingest = await apiPost(page.request, '/api/ingest', {
    collectedAt: new Date().toISOString(),
    rows: [{
      platform: 'tmall',
      storeId: 'pw_run_console_store',
      externalSkuId: `pw_run_console_sku_${stamp}`,
      productName: 'Run Console 页面验收 SKU',
      stock: 88,
      sales30d: 188,
      positiveRate: 0.98,
      raw: { externalSkuId: `pw_run_console_sku_${stamp}` },
    }],
  })
  const report = await apiPost(page.request, '/api/reports', {
    type: 'HEALTH',
    skuProfileIds: [ingest.summaries[0].skuProfileId],
    simulationResultIds: [],
  })
  const runId = report.workflowRunId
  expect(runId).toBeTruthy()

  await page.goto(`${baseURL}/run-console?runId=${runId}`, { waitUntil: 'networkidle' })
  await expect(page.getByText(`Run #${runId.slice(0, 8)}`, { exact: true })).toBeVisible()
  await expect(page.getByText('状态: SUCCEEDED')).toBeVisible()
  await expect(page.getByText('类型: report_generate')).toBeVisible()
  await expect(page.getByRole('link', { name: /对象:/ })).toHaveAttribute('href', `/report-center?reportId=${report.reportId}`)
  await expect(page.getByLabel('打开来源对象')).toHaveAttribute('href', `/report-center?reportId=${report.reportId}`)

  await page.getByRole('button', { name: 'Raw Logs' }).click()
  await expect(page).toHaveURL(/tab=raw/)
  await expect(page.getByText(runId)).toBeVisible()
  await page.getByRole('button', { name: 'Tool Traces' }).click()
  await expect(page).toHaveURL(/tab=tools/)
  await expect(page.getByText('输入：').first()).toBeVisible()
  await expect(page.getByText(report.reportId).first()).toBeVisible()

  const exportResponse = page.waitForResponse((response) => response.url().endsWith(`/api/run-console/${runId}/export`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: /导出日志/ }).click()
  const exportEnvelope = await (await exportResponse).json()
  expect(exportEnvelope.code).toBe('OK')
  expect(exportEnvelope.data.runId).toBe(runId)
  expect(exportEnvelope.data.lineCount).toBeGreaterThan(0)
  await expect(page.getByText(new RegExp(`已导出 Run 日志：${escapeRegExp(runId)}`))).toBeVisible()
  await expect(page.getByRole('link', { name: '查看 Raw Logs' })).toHaveAttribute('href', `/run-console?runId=${runId}&tab=raw`)

  const retryButton = page.getByRole('button', { name: /重试失败项/ })
  await expect(retryButton).toBeDisabled()
  await expect(retryButton).toHaveAttribute('title', '当前 Run 状态为 SUCCEEDED，不需要重试。')
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
