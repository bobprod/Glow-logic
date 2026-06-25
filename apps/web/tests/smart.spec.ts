import { test, expect } from '@playwright/test';

test.describe('SMART Page Tests', () => {
  test('should load the SMART page successfully', async ({ page }) => {
    // Navigate to SMART page
    const response = await page.goto('http://localhost:3000/smart');

    // Check response status
    expect(response?.status()).toBe(200);

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check page title/content
    await expect(page.locator('body')).toBeVisible();

    // Check for key elements
    await expect(page.getByText('SMART SYNC HUB')).toBeVisible({ timeout: 10000 });
  });

  test('should display BPM indicator', async ({ page }) => {
    await page.goto('http://localhost:3000/smart');
    await page.waitForLoadState('networkidle');

    // Check for BPM text
    await expect(page.getByText('BPM')).toBeVisible();
  });

  test('should display STAGE VIEW section', async ({ page }) => {
    await page.goto('http://localhost:3000/smart');
    await page.waitForLoadState('networkidle');

    // Check for STAGE VIEW
    await expect(page.getByText('STAGE VIEW')).toBeVisible();
  });

  test('should display PIXEL & SHAPE ENGINE section', async ({ page }) => {
    await page.goto('http://localhost:3000/smart');
    await page.waitForLoadState('networkidle');

    // Check for PIXEL & SHAPE
    await expect(page.getByText('PIXEL & SHAPE')).toBeVisible();
  });

  test('should display SMART SCENE LAUNCHER section', async ({ page }) => {
    await page.goto('http://localhost:3000/smart');
    await page.waitForLoadState('networkidle');

    // Check for SMART SCENE
    await expect(page.getByText('SMART SCENE')).toBeVisible();
  });

  test('should have no critical console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/smart');
    await page.waitForLoadState('networkidle');

    // Filter out non-critical errors
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('hydration'));

    expect(criticalErrors).toHaveLength(0);
  });
});