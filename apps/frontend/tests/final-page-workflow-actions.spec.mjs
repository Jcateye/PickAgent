import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'

test.describe.configure({ mode: 'serial' })

test('rule library page performs real create, update, version, and disable actions', async ({ page }) => {
  const stamp = Date.now()
  const ruleName = `验收规则集 ${stamp}`
  const updatedName = `${ruleName} 已更新`

  await page.goto(`${baseURL}/rule-library`, { waitUntil: 'networkidle' })
  await page.getByLabel('创建规则集').click()
  await page.getByLabel('规则集名称').fill(ruleName)
  await page.getByLabel('规则原文').fill('库存不得低于 20 件，好评率不得低于 95%。')
  await page.getByLabel('状态').selectOption('ENABLED')

  const createResponse = page.waitForResponse((response) => response.url().endsWith('/api/rule-sets') && response.request().method() === 'POST')
  await page.locator('form').getByRole('button', { name: '创建规则集' }).click()
  const createEnvelope = await (await createResponse).json()
  expect(createEnvelope.code).toBe('OK')
  const ruleSetId = createEnvelope.data.ruleSetId
  expect(ruleSetId).toBeTruthy()
  await expect(page.getByText(`已创建规则集：${ruleName}`)).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`ruleSetId=${ruleSetId}`))

  const versionResponse = page.waitForResponse((response) => response.url().includes(`/api/rule-sets/${ruleSetId}/versions`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: /创建新版本/ }).click()
  const versionEnvelope = await (await versionResponse).json()
  expect(versionEnvelope.code).toBe('OK')
  expect(versionEnvelope.data.workflowRunId).toBeTruthy()
  await expect(page.getByText(/已创建新版本/)).toBeVisible()

  await page.getByRole('button', { name: /编辑/ }).click()
  await page.getByLabel('规则集名称').fill(updatedName)
  const updateResponse = page.waitForResponse((response) => response.url().endsWith(`/api/rule-sets/${ruleSetId}`) && response.request().method() === 'PATCH')
  await page.getByRole('button', { name: '保存规则集' }).click()
  const updateEnvelope = await (await updateResponse).json()
  expect(updateEnvelope.code).toBe('OK')
  expect(updateEnvelope.data.name).toBe(updatedName)
  await expect(page.getByText(`已更新规则集：${updatedName}`)).toBeVisible()

  const disableButton = page.getByRole('button', { name: '禁用', exact: true })
  await expect(disableButton).toBeEnabled()
  const disableResponse = page.waitForResponse((response) => response.url().endsWith(`/api/rule-sets/${ruleSetId}`) && response.request().method() === 'DELETE')
  await disableButton.click()
  const disableEnvelope = await (await disableResponse).json()
  expect(disableEnvelope.code).toBe('OK')
  expect(disableEnvelope.data.status).toBe('DISABLED')
  await expect(page.getByText(`${updatedName} 已禁用`)).toBeVisible()
})

test('data sources page creates a browser connector and writes scanned SKU data through real APIs', async ({ page }) => {
  const stamp = Date.now()
  const connectorCode = `pw_browser_connector_${stamp}`
  const connectorName = `验收浏览器连接器 ${stamp}`
  const externalSkuId = `pw_scan_sku_${stamp}`

  await page.goto(`${baseURL}/data-sources`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /添加连接器/ }).click()
  await page.getByLabel('编码').fill(connectorCode)
  await page.getByLabel('名称').fill(connectorName)
  await page.getByLabel('类型').selectOption('browser_extension')
  await page.getByRole('textbox', { name: '平台' }).fill('tmall')
  await page.getByLabel('配置 JSON').fill(JSON.stringify({ storeId: 'pw_store', source: 'playwright' }, null, 2))

  const createResponse = page.waitForResponse((response) => response.url().endsWith('/api/connectors') && response.request().method() === 'POST')
  await page.locator('form').getByRole('button', { name: '添加连接器' }).click()
  const createEnvelope = await (await createResponse).json()
  expect(createEnvelope.code).toBe('OK')
  const connectorId = createEnvelope.data.connectorId
  expect(connectorId).toBeTruthy()
  await expect(page.getByText(`已添加连接器：${connectorName}`)).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`connectorId=${connectorId}`))

  await expect(page.getByText('浏览器扫描写入')).toBeVisible()
  await page.getByLabel('店铺 ID').fill('pw_store')
  await page.getByLabel('扫描 rows JSON').fill(JSON.stringify([
    {
      sku: externalSkuId,
      title: 'Playwright 扫描写入 SKU',
      stock: 64,
      sales: 288,
      positiveRate: 0.97,
    },
  ], null, 2))

  const previewResponse = page.waitForResponse((response) => response.url().endsWith('/api/connectors/browser/scan-preview') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '预览字段' }).click()
  const previewEnvelope = await (await previewResponse).json()
  expect(previewEnvelope.code).toBe('OK')
  expect(previewEnvelope.data.ingestReady).toBe(true)
  await expect(page.getByText(/预览完成：1 行/)).toBeVisible()

  const ingestResponse = page.waitForResponse((response) => response.url().endsWith('/api/connectors/browser/scan-ingest') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '写入 SKU' }).click()
  const ingestEnvelope = await (await ingestResponse).json()
  expect(ingestEnvelope.code).toBe('OK')
  expect(ingestEnvelope.data.ingest.summaries[0].canonicalSkuKey).toBe(`tmall:pw_store:${externalSkuId}`)
  expect(ingestEnvelope.data.run.connectorId).toBe(connectorId)
  await expect(page.getByText(/已写入 1 个 SKU/)).toBeVisible()
  await expect(page.getByRole('link', { name: '查看采集 Run' })).toBeVisible()
  await expect(page.getByRole('link', { name: '查看写入 SKU' })).toBeVisible()
})
