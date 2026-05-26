import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3204'

test('report center and review approvals hydrate without console hydration errors', async ({ page }) => {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`${baseURL}/report-center`, { waitUntil: 'networkidle' })
  await expect(page.getByText('报告中心').first()).toBeVisible()
  await page.goto(`${baseURL}/review-approvals`, { waitUntil: 'networkidle' })
  await expect(page.getByText('Review 审批').first()).toBeVisible()

  const hydrationErrors = errors.filter((line) => /hydration|Hydration|did not match|Text content does not match/i.test(line))
  expect(hydrationErrors).toEqual([])
})
