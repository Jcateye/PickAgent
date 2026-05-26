import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'
const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'playwright_sku_report_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'playwright_sku_report_session',
  'x-p0-surface': 'playwright-sku-report-test',
  'x-request-id': 'playwright_sku_report_request',
}

test('sku access health report uses the full filtered result, not only the current page', async ({ page }) => {
  const stamp = Date.now()
  const prefix = `pw_report_filter_${stamp}`
  const rows = Array.from({ length: 25 }, (_, index) => ({
    platform: 'tmall',
    storeId: `pw_report_store_${stamp}`,
    externalSkuId: `${prefix}_${index}`,
    productName: `SKU 报告筛选 ${index}`,
    category: `report_category_${stamp}`,
    stock: 100 + index,
    sales30d: 300 + index,
    positiveRate: 0.99,
    raw: { externalSkuId: `${prefix}_${index}` },
  }))
  const ingest = await page.request.post(`${baseURL}/api/ingest`, {
    headers: authHeaders,
    data: { collectedAt: new Date().toISOString(), rows },
  })
  expect(ingest.ok()).toBeTruthy()

  await page.goto(`${baseURL}/sku-access?q=${prefix}`, { waitUntil: 'networkidle' })
  await expect(page.getByText('共 25 条')).toBeVisible()

  const reportResponsePromise = page.waitForResponse((response) => response.url() === `${baseURL}/api/reports` && response.request().method() === 'POST')
  await page.getByRole('button', { name: '生成健康报告' }).click()
  const reportResponse = await reportResponsePromise
  expect(reportResponse.ok()).toBeTruthy()
  const envelope = await reportResponse.json()
  expect(envelope.code).toBe('OK')
  expect(envelope.data.sections[0].summary).toContain('覆盖 25 个 SKU')
})
