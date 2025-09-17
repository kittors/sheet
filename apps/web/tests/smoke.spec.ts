import { test, expect } from '@playwright/test'

test('renders canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
})
