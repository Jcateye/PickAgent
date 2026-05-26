import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'
const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'playwright_page_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'playwright_page_session',
  'x-p0-surface': 'playwright-page-test',
  'x-request-id': 'playwright_page_request',
}

test.describe.configure({ mode: 'serial' })

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

  await page.getByRole('button', { name: '配置' }).click()
  await page.getByRole('button', { name: '编辑配置' }).click()
  await page.getByLabel('名称').fill(`${connectorName} 已编辑`)
  await page.getByLabel('配置 JSON').fill(JSON.stringify({ storeId: 'pw_store', source: 'playwright', edited: true }, null, 2))
  const updateResponse = page.waitForResponse((response) => response.url().endsWith(`/api/connectors/${connectorId}`) && response.request().method() === 'PATCH')
  await page.locator('form').getByRole('button', { name: '保存配置' }).click()
  const updateEnvelope = await (await updateResponse).json()
  expect(updateEnvelope.code).toBe('OK')
  expect(updateEnvelope.data.name).toBe(`${connectorName} 已编辑`)
  expect(updateEnvelope.data.config.edited).toBe(true)
  await expect(page.getByText(`已更新连接器配置：${connectorName} 已编辑`)).toBeVisible()

  const editedConnectorCard = page.getByRole('button', { name: new RegExp(`${escapeRegExp(connectorName)} 已编辑`) }).first()
  const runResponse = page.waitForResponse((response) => response.url().endsWith(`/api/connectors/${connectorId}/sync-runs`) && response.request().method() === 'POST')
  await editedConnectorCard.getByRole('button', { name: '新建运行' }).click({ force: true })
  const runEnvelope = await (await runResponse).json()
  expect(runEnvelope.code).toBe('OK')
  expect(runEnvelope.data.connectorId).toBe(connectorId)
  expect(runEnvelope.data.rowCount).toBe(256)
  await expect(page.getByText(new RegExp(`已创建采集运行：${runEnvelope.data.connectorRunId}`))).toBeVisible()

  const disableResponse = page.waitForResponse((response) => response.url().endsWith(`/api/connectors/${connectorId}`) && response.request().method() === 'DELETE')
  await editedConnectorCard.getByRole('button', { name: '停用' }).click({ force: true })
  const disableEnvelope = await (await disableResponse).json()
  expect(disableEnvelope.code).toBe('OK')
  expect(disableEnvelope.data.status).toBe('DISABLED')
  await expect(page.getByText(`${connectorName} 已编辑 已停用`)).toBeVisible()

  const enableResponse = page.waitForResponse((response) => response.url().endsWith(`/api/connectors/${connectorId}`) && response.request().method() === 'PATCH')
  await editedConnectorCard.getByRole('button', { name: '启用' }).click({ force: true })
  const enableEnvelope = await (await enableResponse).json()
  expect(enableEnvelope.code).toBe('OK')
  expect(enableEnvelope.data.status).toBe('ACTIVE')
  await expect(page.getByText(`${connectorName} 已编辑 已启用`)).toBeVisible()
})

test('rule execution page runs real parsing and simulation then saves the rule set', async ({ page }) => {
  const stamp = Date.now()
  const ruleName = `页面执行规则 ${stamp}`

  await apiPost(page.request, '/api/ingest', {
    collectedAt: new Date().toISOString(),
    rows: [{
      platform: 'tmall',
      storeId: 'pw_rule_execution_store',
      externalSkuId: `pw_rule_execution_sku_${stamp}`,
      productName: '页面规则执行 SKU',
      stock: 18,
      sales30d: 180,
      positiveRate: 0.96,
      raw: { externalSkuId: `pw_rule_execution_sku_${stamp}` },
    }],
  })

  await page.goto(`${baseURL}/rule-execution`, { waitUntil: 'networkidle' })
  await page.getByLabel('规则名称').fill(ruleName)
  await page.getByLabel('规则原文').fill('库存不得低于 20 件，好评率不得低于 95%。')

  const parseResponse = page.waitForResponse((response) => response.url().endsWith('/api/activities/parse') && response.request().method() === 'POST')
  const simulationResponse = page.waitForResponse((response) => /\/api\/rule-sets\/[^/]+\/simulations$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
  await page.getByRole('button', { name: /运行检查/ }).first().click()
  const parseEnvelope = await (await parseResponse).json()
  const simulationEnvelope = await (await simulationResponse).json()
  expect(parseEnvelope.code).toBe('OK')
  expect(simulationEnvelope.code).toBe('OK')
  expect(simulationEnvelope.data.results.length).toBeGreaterThan(0)
  await expect(page.getByText(/运行检查已完成/)).toBeVisible()

  const saveResponse = page.waitForResponse((response) => response.url().endsWith('/api/rule-sets') && response.request().method() === 'POST')
  await page.getByTitle('保存到规则库').click()
  const saveEnvelope = await (await saveResponse).json()
  expect(saveEnvelope.code).toBe('OK')
  expect(saveEnvelope.data.ruleSetId).toBeTruthy()
  await expect(page.getByText(/已保存到规则库/)).toBeVisible()
})

test('sku access page creates reviews, updates next actions, exports rows, and generates a report', async ({ page }) => {
  const stamp = Date.now()
  const externalSkuId = `pw_sku_access_${stamp}`

  const ingest = await apiPost(page.request, '/api/ingest', {
    collectedAt: new Date().toISOString(),
    rows: [{
      platform: 'tmall',
      storeId: 'pw_sku_access_store',
      externalSkuId,
      productName: '页面 SKU 工作台验收',
      stock: 42,
      sales30d: 210,
      positiveRate: 0.98,
      certificateStatus: 'valid',
      raw: { externalSkuId },
    }],
  })
  const skuProfileId = ingest.summaries[0].skuProfileId

  await page.goto(`${baseURL}/sku-access?q=${externalSkuId}`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('table').getByText('页面 SKU 工作台验收')).toBeVisible()
  await page.locator('tbody input[type="checkbox"]').first().check()

  const reviewResponse = page.waitForResponse((response) => response.url().endsWith('/api/reviews') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '批量生成 Review' }).click()
  const reviewEnvelope = await (await reviewResponse).json()
  expect(reviewEnvelope.code).toBe('OK')
  expect(reviewEnvelope.data[0].skuProfileId).toBe(skuProfileId)
  await expect(page.getByText(/已生成 Review/)).toBeVisible()

  await page.locator('tbody input[type="checkbox"]').first().check()
  await page.getByLabel('下一步动作').selectOption('MANUAL_REVIEW')
  const nextActionResponse = page.waitForResponse((response) => response.url().includes(`/api/skus/${skuProfileId}`) && response.request().method() === 'PATCH')
  await page.getByRole('button', { name: '批量设置下一步' }).click()
  const nextActionEnvelope = await (await nextActionResponse).json()
  expect(nextActionEnvelope.code).toBe('OK')
  expect(nextActionEnvelope.data.statusSummary.nextStep).toBe('提交人工确认')
  await expect(page.getByText(/已设置下一步：提交人工确认/)).toBeVisible()

  const exportResponse = page.waitForResponse((response) => response.url().endsWith('/api/skus/export') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '导出当前结果' }).click()
  const exportEnvelope = await (await exportResponse).json()
  expect(exportEnvelope.code).toBe('OK')
  expect(exportEnvelope.data.rowCount).toBeGreaterThan(0)
  await expect(page.getByText(/已导出 SKU 当前筛选结果/)).toBeVisible()

  const reportResponse = page.waitForResponse((response) => response.url().endsWith('/api/reports') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '生成健康报告' }).click()
  const reportEnvelope = await (await reportResponse).json()
  expect(reportEnvelope.code).toBe('OK')
  expect(reportEnvelope.data.reportId).toBeTruthy()
  await expect(page.getByText(/已生成健康报告/)).toBeVisible()
})

test('review approvals page edits recommendations and applies approve, reject, and request-changes decisions', async ({ page }) => {
  const stamp = Date.now()
  const approveCreated = await apiPost(page.request, '/api/reviews', {
    items: [{
      sourceType: 'agent',
      sourceId: `pw_review_source_${stamp}`,
      question: `页面审批验收 ${stamp}`,
      recommendation: '通过页面审批按钮验证真实 Review 决策。',
      riskLevel: 'L1',
      evidence: [{ type: 'tool_trace', entityId: `pw_review_source_${stamp}`, label: '页面验收证据', summary: 'Playwright seeded review' }],
    }],
  })
  const rejectCreated = await apiPost(page.request, '/api/reviews', {
    items: [{
      sourceType: 'agent',
      sourceId: `pw_review_reject_source_${stamp}`,
      question: `页面驳回验收 ${stamp}`,
      recommendation: '通过页面驳回按钮验证真实 Review 决策。',
      riskLevel: 'L1',
      evidence: [{ type: 'tool_trace', entityId: `pw_review_reject_source_${stamp}`, label: '页面驳回证据', summary: 'Playwright seeded rejected review' }],
    }],
  })
  const modifyCreated = await apiPost(page.request, '/api/reviews', {
    items: [{
      sourceType: 'agent',
      sourceId: `pw_review_modify_source_${stamp}`,
      question: `页面修改后批准验收 ${stamp}`,
      recommendation: '通过页面修改后批准按钮验证真实 Review 决策。',
      riskLevel: 'L2',
      evidence: [{ type: 'tool_trace', entityId: `pw_review_modify_source_${stamp}`, label: '页面修改证据', summary: 'Playwright seeded modified review' }],
    }],
  })
  const approveReviewItemId = approveCreated[0].reviewItemId
  const rejectReviewItemId = rejectCreated[0].reviewItemId
  const modifyReviewItemId = modifyCreated[0].reviewItemId

  await page.goto(`${baseURL}/review-approvals?reviewItemId=${approveReviewItemId}`, { waitUntil: 'networkidle' })
  await expect(page.getByText(`页面审批验收 ${stamp}`).first()).toBeVisible()
  await page.locator('textarea').first().fill(`已编辑建议 ${stamp}`)
  const saveResponse = page.waitForResponse((response) => response.url().endsWith(`/api/reviews/${approveReviewItemId}`) && response.request().method() === 'PATCH')
  await page.getByRole('button', { name: '保存建议修改' }).click()
  const saveEnvelope = await (await saveResponse).json()
  expect(saveEnvelope.code).toBe('OK')
  expect(saveEnvelope.data.recommendation.content).toBe(`已编辑建议 ${stamp}`)
  await expect(page.getByText(`已保存 Review 建议：${approveReviewItemId}`)).toBeVisible()

  await page.getByPlaceholder('请输入审批备注，便于后续追溯...').fill('页面验收批准')

  const decisionResponse = page.waitForResponse((response) => response.url().endsWith(`/api/reviews/${approveReviewItemId}/decision`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '批准', exact: true }).click()
  const decisionEnvelope = await (await decisionResponse).json()
  expect(decisionEnvelope.code).toBe('OK')
  expect(decisionEnvelope.data.status).toBe('APPROVED')
  await expect(page.getByText(new RegExp(`${approveReviewItemId} 已批准`))).toBeVisible()

  await page.goto(`${baseURL}/review-approvals?reviewItemId=${rejectReviewItemId}`, { waitUntil: 'networkidle' })
  await expect(page.getByText(`页面驳回验收 ${stamp}`).first()).toBeVisible()
  await page.getByPlaceholder('请输入审批备注，便于后续追溯...').fill('页面验收驳回')
  const rejectResponse = page.waitForResponse((response) => response.url().endsWith(`/api/reviews/${rejectReviewItemId}/decision`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '驳回', exact: true }).click()
  const rejectEnvelope = await (await rejectResponse).json()
  expect(rejectEnvelope.code).toBe('OK')
  expect(rejectEnvelope.data.status).toBe('REJECTED')
  await expect(page.getByText(new RegExp(`${rejectReviewItemId} 已驳回`))).toBeVisible()

  await page.goto(`${baseURL}/review-approvals?reviewItemId=${modifyReviewItemId}`, { waitUntil: 'networkidle' })
  await expect(page.getByText(`页面修改后批准验收 ${stamp}`).first()).toBeVisible()
  await page.getByPlaceholder('请输入审批备注，便于后续追溯...').fill('页面验收修改后批准')
  const modifyResponse = page.waitForResponse((response) => response.url().endsWith(`/api/reviews/${modifyReviewItemId}/decision`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '修改后批准', exact: true }).click()
  const modifyHttpResponse = await modifyResponse
  const modifyRequestBody = modifyHttpResponse.request().postDataJSON()
  const modifyEnvelope = await modifyHttpResponse.json()
  expect(modifyEnvelope.code).toBe('OK')
  expect(modifyEnvelope.data.status).toBe('MODIFIED')
  expect(modifyRequestBody.modifiedPayload.requestedFrom).toBe('review-approvals')
  await expect(page.getByText(new RegExp(`${modifyReviewItemId} 已修改后批准`))).toBeVisible()
})

test('report center page exports, subscribes, and compares real reports', async ({ page }) => {
  const stamp = Date.now()
  const ingest = await apiPost(page.request, '/api/ingest', {
    collectedAt: new Date().toISOString(),
    rows: [{
      platform: 'tmall',
      storeId: 'pw_report_store',
      externalSkuId: `pw_report_sku_${stamp}`,
      productName: '页面报告中心 SKU',
      stock: 55,
      sales30d: 188,
      positiveRate: 0.99,
      raw: { externalSkuId: `pw_report_sku_${stamp}` },
    }],
  })
  const skuProfileId = ingest.summaries[0].skuProfileId
  const firstReport = await apiPost(page.request, '/api/reports', { type: 'HEALTH', skuProfileIds: [skuProfileId], simulationResultIds: [] })
  const secondReport = await apiPost(page.request, '/api/reports', { type: 'HEALTH', skuProfileIds: [skuProfileId], simulationResultIds: [] })

  await page.goto(`${baseURL}/report-center?reportId=${firstReport.reportId}`, { waitUntil: 'networkidle' })
  await expect(page.getByText(firstReport.reportId)).toBeVisible()

  const exportResponse = page.waitForResponse((response) => response.url().endsWith(`/api/reports/${firstReport.reportId}/export`) && response.request().method() === 'POST')
  await page.locator('button.primaryButton', { hasText: '导出' }).click()
  const exportEnvelope = await (await exportResponse).json()
  expect(exportEnvelope.code).toBe('OK')
  expect(exportEnvelope.data.artifactHref).toContain(`/api/reports/${firstReport.reportId}/download`)
  await expect(page.getByText(/已生成导出文件/)).toBeVisible()

  await page.getByPlaceholder('多个邮箱用逗号或换行分隔').fill('ops@example.test')
  const subscriptionResponse = page.waitForResponse((response) => response.url().endsWith(`/api/reports/${firstReport.reportId}/subscriptions`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '去订阅' }).click()
  const subscriptionEnvelope = await (await subscriptionResponse).json()
  expect(subscriptionEnvelope.code).toBe('OK')
  expect(subscriptionEnvelope.data.reportId).toBe(firstReport.reportId)
  await expect(page.getByText(/已更新订阅/)).toBeVisible()

  await page.goto(`${baseURL}/report-center?reportId=${secondReport.reportId}`, { waitUntil: 'networkidle' })
  const compareResponse = page.waitForResponse((response) => response.url().endsWith('/api/reports/compare') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '+ 对比报告' }).click()
  const compareEnvelope = await (await compareResponse).json()
  expect(compareEnvelope.code).toBe('OK')
  expect(compareEnvelope.data.baseReportId).toBe(secondReport.reportId)
  await expect(page.getByText(/已生成报告对比/)).toBeVisible()
})
