import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'

test('agent chat page submits a business question and renders tool trace, evidence, and workbench links', async ({ page }) => {
  const requestBodies = []

  await page.route('**/api/agent/sessions/**/messages?limit=50', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ code: 'OK', message: 'OK', data: { items: [] } }),
    })
  })

  await page.route('**/api/agent/runs/run-chat-ui/events?after=0', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ code: 'OK', message: 'OK', data: { items: [] } }),
    })
  })

  await page.route('**/api/agent/chat', async (route) => {
    const request = route.request()
    requestBodies.push(request.postDataJSON())
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        code: 'OK',
        message: 'OK',
        data: {
          missionId: 'mission-chat-ui',
          runId: 'run-chat-ui',
          assistantMessage: {
            id: 'assistant-chat-ui',
            role: 'assistant',
            content: '已读取 SKU、规则和报告数据，建议先处理低库存 SKU 并生成 Review。',
            status: 'completed',
            linkedEntityIds: ['sku-chat-ui'],
            evidenceRefIds: ['evidence-chat-ui'],
          },
          toolTrace: [
            {
              id: 'tool-chat-ui',
              toolName: 'getHealthSummary',
              status: 'succeeded',
              riskLevel: 'L0',
              reviewPolicy: 'none',
              inputSummary: '读取 Overview 健康摘要',
              outputSummary: '发现 1 个低库存 SKU 和 1 个待审批 Review',
              evidenceRefs: ['evidence-chat-ui'],
            },
          ],
          evidenceRefs: [
            {
              id: 'evidence-chat-ui',
              evidenceType: 'tool_result',
              label: 'SKU 健康摘要',
              summary: '库存低于阈值，需要补货或人工确认。',
              entityType: 'sku_profile',
              entityId: 'sku-chat-ui',
            },
          ],
          linkedEntities: [
            {
              id: 'link-chat-ui',
              entityType: 'sku_profile',
              entityId: 'sku-chat-ui',
              label: '低库存 SKU',
              reason: '跳转到 SKU 工作台查看证据',
              sourceType: 'tool_call',
              sourceId: 'tool-chat-ui',
              href: '/sku-access?skuProfileId=sku-chat-ui&drawerTab=evidence',
            },
          ],
          reviewGate: null,
          fallbackUsed: false,
        },
      }),
    })
  })

  await page.goto(`${baseURL}/agent-chat`, { waitUntil: 'networkidle' })
  const main = page.getByRole('main')
  await expect(main.getByText('从一个问题开始')).toBeVisible()

  await main.getByPlaceholder('Reply to SKU Ready Agent...').fill('帮我检查当前 SKU 风险，并给出下一步处理建议')
  await main.getByRole('button', { name: '发送' }).click()

  await expect(main.getByText('帮我检查当前 SKU 风险，并给出下一步处理建议')).toBeVisible()
  await expect(main.getByText('已读取 SKU、规则和报告数据，建议先处理低库存 SKU 并生成 Review。')).toBeVisible()
  await expect(main.getByText('思考过程')).toBeVisible()
  await expect(main.getByText('工具链', { exact: true })).toBeVisible()
  await expect(main.getByText('Tool Call: getHealthSummary')).toBeVisible()
  await expect(main.getByText('发现 1 个低库存 SKU 和 1 个待审批 Review')).toBeVisible()
  await expect(main.getByText('证据链')).toBeVisible()
  await expect(main.getByText('SKU 健康摘要')).toBeVisible()

  const skuLink = main.getByRole('link', { name: /低库存 SKU: 跳转到 SKU 工作台查看证据/ })
  await expect(skuLink).toBeVisible()
  await expect(skuLink).toHaveAttribute('href', '/sku-access?skuProfileId=sku-chat-ui&drawerTab=evidence')
  await expect(main.getByText(/runId: run-chat-ui/)).toBeVisible()

  expect(requestBodies).toHaveLength(1)
  expect(requestBodies[0].message).toBe('帮我检查当前 SKU 风险，并给出下一步处理建议')
  expect(requestBodies[0].context.route).toBe('/agent-chat')
  expect(requestBodies[0].context.visibleColumns).toEqual(['conversation', 'trace', 'evidence'])
})

test('agent chat page surfaces backend failures instead of pretending to answer', async ({ page }) => {
  await page.route('**/api/agent/sessions/**/messages?limit=50', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ code: 'OK', message: 'OK', data: { items: [] } }),
    })
  })

  await page.route('**/api/agent/chat', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 503,
      body: JSON.stringify({
        code: 'AGENT.REAL_CHAT_NOT_CONFIGURED',
        message: 'Real Agent chat requires persistent conversation storage and a model adapter before it can answer.',
        data: { missing: ['modelAdapter'] },
      }),
    })
  })

  await page.goto(`${baseURL}/agent-chat`, { waitUntil: 'networkidle' })
  const main = page.getByRole('main')
  await main.getByPlaceholder('Reply to SKU Ready Agent...').fill('现在能自动处理所有 Review 吗？')
  await main.getByRole('button', { name: '发送' }).click()

  await expect(main.getByText(/当前无法完成真实对话请求/)).toBeVisible()
  await expect(main.getByText(/错误：Real Agent chat requires persistent conversation storage/)).toBeVisible()
})

test('agent chat page restores historical evidence and workbench links after reload', async ({ page }) => {
  await page.route('**/api/agent/sessions/**/messages?limit=50', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        code: 'OK',
        message: 'OK',
        data: {
          items: [{
            id: 'assistant-recovered-ui',
            role: 'assistant',
            content: '历史会话已恢复报告和证据。',
            status: 'completed',
            linkedEntityIds: ['entity_report_1'],
            evidenceRefIds: ['evidence_report_1'],
            runId: 'run-recovered-ui',
            createdAt: new Date().toISOString(),
            turn: {
              runId: 'run-recovered-ui',
              fallbackUsed: false,
              thoughts: ['从历史消息恢复工具链摘要。'],
              toolTrace: [{
                id: 'tool_call_report_1',
                toolName: 'generateReport',
                status: 'succeeded',
                riskLevel: 'L2',
                reviewPolicy: 'review_gate',
                inputSummary: '',
                outputSummary: '恢复后的报告生成结果',
                evidenceRefs: ['evidence_report_1'],
              }],
              evidenceRefs: [{
                id: 'evidence_report_1',
                evidenceType: 'tool_result',
                label: '报告生成输入',
                summary: '恢复后的报告生成证据摘要',
                entityType: 'report',
                entityId: 'report_1',
              }],
              linkedEntities: [{
                id: 'entity_report_1',
                entityType: 'report',
                entityId: 'report_1',
                label: '历史报告',
                reason: '查看恢复后的报告',
                sourceType: 'tool_call',
                sourceId: 'tool_call_report_1',
                href: '/report-center?reportId=report_1',
              }],
              reviewGate: null,
            },
          }],
        },
      }),
    })
  })

  await page.route('**/api/agent/runs/run-recovered-ui/events?after=0**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ code: 'OK', message: 'OK', data: { items: [], after: 0 } }),
    })
  })

  await page.goto(`${baseURL}/agent-chat`, { waitUntil: 'networkidle' })
  const main = page.getByRole('main')
  await expect(main.getByText('历史会话已恢复报告和证据。')).toBeVisible()
  await expect(main.getByText('Tool Call: generateReport')).toBeVisible()
  await expect(main.getByText('恢复后的报告生成结果')).toBeVisible()
  await expect(main.getByText('报告生成输入')).toBeVisible()
  await expect(main.getByText('恢复后的报告生成证据摘要')).toBeVisible()
  await expect(main.getByRole('link', { name: /历史报告: 查看恢复后的报告/ })).toHaveAttribute('href', '/report-center?reportId=report_1')
  await expect(main.getByText(/runId: run-recovered-ui/)).toBeVisible()
})
