import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'
const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'playwright_topbar_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'playwright_topbar_session',
  'x-p0-surface': 'playwright-topbar-test',
  'x-request-id': 'playwright_topbar_request',
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

test('topbar search filters and evidence drawer use real API state', async ({ page }) => {
  const skuRequestUrls = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/skus') skuRequestUrls.push(url.toString())
  })
  const stamp = Date.now()
  const externalSkuId = `pw_topbar_sku_${stamp}`
  const storeId = `pw_topbar_store_${stamp}`
  const category = `topbar_category_${stamp}`
  const ingest = await apiPost(page.request, '/api/ingest', {
    collectedAt: new Date().toISOString(),
    rows: [{
      platform: 'tmall',
      storeId,
      externalSkuId,
      productName: 'Topbar 全局搜索验收 SKU',
      category,
      stock: 95,
      sales30d: 260,
      positiveRate: 0.99,
      raw: { externalSkuId },
    }],
  })
  const report = await apiPost(page.request, '/api/reports', {
    type: 'HEALTH',
    skuProfileIds: [ingest.summaries[0].skuProfileId],
    simulationResultIds: [],
  })
  const runId = report.workflowRunId
  expect(runId).toBeTruthy()

  await page.goto(`${baseURL}/overview`, { waitUntil: 'networkidle' })
  const searchInput = page.getByRole('textbox', { name: '全局搜索', exact: true })
  await expect(searchInput).toBeVisible()
  await searchInput.fill(externalSkuId)
  await page.getByLabel('全局搜索平台').selectOption('tmall')
  await page.getByLabel('全局搜索店铺').fill(storeId)
  await page.getByLabel('全局搜索类目').fill(category)
  await expect(searchInput).toHaveValue(externalSkuId)
  await expect(page.getByLabel('全局搜索店铺')).toHaveValue(storeId)
  await expect(page.getByLabel('全局搜索类目')).toHaveValue(category)
  await page.getByRole('button', { name: '执行全局搜索' }).click()

  await expect(page).toHaveURL(/\/sku-access/)
  await expect(page.getByText(externalSkuId).first()).toBeVisible()
  const matchedSkuRequest = skuRequestUrls.some((value) => {
    const url = new URL(value)
    return url.searchParams.get('q') === externalSkuId
      && url.searchParams.get('platform') === 'tmall'
      && url.searchParams.get('storeId') === storeId
      && url.searchParams.get('category') === category
  })
  expect(matchedSkuRequest, skuRequestUrls.join('\n')).toBeTruthy()

  await page.goto(`${baseURL}/overview`, { waitUntil: 'networkidle' })
  const latestRun = page.getByRole('link', { name: new RegExp(`Latest Run #${runId.slice(0, 8)}`) })
  await expect(latestRun).toHaveAttribute('href', `/run-console?runId=${runId}`)

  await page.getByRole('button', { name: '证据链侧栏' }).click()
  await expect(page.getByRole('complementary', { name: '证据链侧栏' })).toBeVisible()
  await expect(page.getByText(`最近 Run #${runId.slice(0, 8)}`)).toBeVisible()
  await expect(page.getByText(/当前 SKU \d+ 个/)).toBeVisible()
  await expect(page.getByRole('link', { name: /运行证据/ })).toHaveAttribute('href', `/run-console?runId=${runId}`)
})
