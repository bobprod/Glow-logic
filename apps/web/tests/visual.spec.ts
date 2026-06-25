import { expect, test } from '@playwright/test';
import { stubBackend } from './helpers/stubBackend';

test.describe('Glow Logic visual smoke', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page);
  });

  test('shows core Smart modules and safety indicators', async ({ page }) => {
    await page.goto('/smart');

    await expect(page.locator('.scene-pads-grid')).toBeVisible();
    await expect(page.locator('.dmx-groups-mixer')).toBeVisible();
    await expect(page.getByText('Master dimmer')).toBeVisible();
    await expect(page.getByText('LASER')).toBeVisible();
    await expect(page.getByText('PYRO')).toBeVisible();
  });

  test('guided tour reaches project export and import steps', async ({ page }) => {
    await page.goto('/smart');
    await page.evaluate(() => window.dispatchEvent(new Event('glowlogic:start-tour')));

    await expect(page.getByText('Guide 1/12')).toBeVisible();

    for (let index = 0; index < 8; index += 1) {
      await page.getByRole('button', { name: /Suivant/i }).click();
    }

    await expect(page.getByText('Export show propre')).toBeVisible();
    await expect(page.locator('.project-export-button')).toBeVisible();

    await page.getByRole('button', { name: /Suivant/i }).click();
    await expect(page.getByText('Import projet')).toBeVisible();
    await expect(page.locator('.project-import-button')).toBeVisible();
  });

  test('project modal exposes final import and export controls', async ({ page }) => {
    await page.goto('/smart');
    await page.getByText('Current Project').click();

    await expect(page.locator('.project-export-button')).toBeVisible();
    await expect(page.locator('.project-import-button')).toBeVisible();
    await expect(page.getByText('Exporter .glowproject')).toBeVisible();
    await expect(page.getByText('Importer .glowproject')).toBeVisible();
  });

  test('fixture profile import entry is visible in patch view', async ({ page }) => {
    await page.goto('/smart');
    await page.getByRole('button', { name: /FIXTURES/i }).click();

    await expect(page.locator('.fixture-profile-import-entry')).toBeVisible();
    await expect(page.locator('.fixture-profile-scan-entry')).toBeVisible();
  });
});
