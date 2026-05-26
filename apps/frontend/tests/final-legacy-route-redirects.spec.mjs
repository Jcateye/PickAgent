import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'

async function expectPathname(page, pathname) {
  await expect.poll(async () => new URL(page.url()).pathname).toBe(pathname)
}

test('legacy console routes redirect to canonical workbench pages', async ({ page }) => {
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle' })
  await expectPathname(page, '/overview')

  await page.goto(`${baseURL}/connectors`, { waitUntil: 'networkidle' })
  await expectPathname(page, '/data-sources')

  await page.goto(`${baseURL}/workflows`, { waitUntil: 'networkidle' })
  await expectPathname(page, '/run-console')

  await page.goto(`${baseURL}/sku-health`, { waitUntil: 'networkidle' })
  await expectPathname(page, '/sku-access')

  await page.goto(`${baseURL}/sku-health/sku_legacy_1`, { waitUntil: 'networkidle' })
  await expect(page).toHaveURL(/\/sku-access\?skuProfileId=sku_legacy_1&drawerTab=evidence$/)
})
