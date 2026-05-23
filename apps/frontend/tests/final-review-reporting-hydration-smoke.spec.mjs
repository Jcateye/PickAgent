import { expect, test } from '@playwright/test'

test('reports and reviews hydrate without console hydration errors', async ({ page }) => {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('http://127.0.0.1:3204/reports', { waitUntil: 'networkidle' })
  await expect(page.getByText('API ready')).toBeVisible()
  await page.goto('http://127.0.0.1:3204/reviews', { waitUntil: 'networkidle' })
  await expect(page.getByText('API ready')).toBeVisible()

  const hydrationErrors = errors.filter((line) => /hydration|Hydration|did not match|Text content does not match/i.test(line))
  expect(hydrationErrors).toEqual([])
})
