import { expect, test } from "@playwright/test";
import { stubBackend, type MockProject } from "./helpers/stubBackend";

const seedFixtures = [
  { id: 1, name: "PAR LED 1", manufacturer: "Glow Test", total_channels: 6, start_address: 1, channels: [] },
  { id: 2, name: "PAR LED 2", manufacturer: "Glow Test", total_channels: 6, start_address: 7, channels: [] },
  { id: 3, name: "PAR LED 3", manufacturer: "Glow Test", total_channels: 6, start_address: 13, channels: [] },
  { id: 4, name: "PAR LED 4", manufacturer: "Glow Test", total_channels: 6, start_address: 19, channels: [] },
  {
    id: 5,
    name: "Lyre Spot 1",
    manufacturer: "Glow Test",
    total_channels: 16,
    start_address: 101,
    channels: [
      { channel: 1, name: "Pan", type: "pan", minVal: 0, maxVal: 255, defaultVal: 127 },
      { channel: 2, name: "Tilt", type: "tilt", minVal: 0, maxVal: 255, defaultVal: 127 },
      { channel: 3, name: "Dimmer", type: "dimmer", minVal: 0, maxVal: 255, defaultVal: 0 },
    ],
  },
  {
    id: 6,
    name: "Lyre Spot 2",
    manufacturer: "Glow Test",
    total_channels: 16,
    start_address: 117,
    channels: [
      { channel: 1, name: "Pan", type: "pan", minVal: 0, maxVal: 255, defaultVal: 127 },
      { channel: 2, name: "Tilt", type: "tilt", minVal: 0, maxVal: 255, defaultVal: 127 },
      { channel: 3, name: "Dimmer", type: "dimmer", minVal: 0, maxVal: 255, defaultVal: 0 },
    ],
  },
];

const seedFixtureGroups = [
  { id: 1, name: "Dancefloor", role: "dancefloor", color: "#06b6d4", fixtureIds: [1, 2, 3, 4] },
  { id: 2, name: "Mouvements", role: "beam", color: "#a855f7", fixtureIds: [5, 6] },
];

test.describe("Show de zero", () => {
  test("genere les pads, construit la timeline, sauvegarde puis recharge le show", async ({ page }) => {
    const projects: MockProject[] = [];
    const backend = await stubBackend(page, {
      fixtures: seedFixtures,
      fixtureGroups: seedFixtureGroups,
      projects,
    });

    await page.goto("/smart");
    await expect(page.locator(".scene-pads-grid")).toBeVisible();

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Generer" }).click();

    await expect(page.getByRole("button", { name: /Scene Accueil doux/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Scene Dancefloor/i })).toBeVisible();
    await expect(page.getByTestId("scene-pad")).toHaveCount(6);

    await page.getByRole("button", { name: "Pads -> Arrangement" }).click();
    await expect(page.locator(".timeline-clip")).toHaveCount(6);
    await expect(page.locator(".timeline-clip").filter({ hasText: "ACCUEIL DOUX" })).toBeVisible();

    await page.getByText("Current Project").click();
    await page.getByLabel("Nom du projet").fill("Show E2E Mariage");
    await page.getByLabel("Sauvegarder projet").click();

    await expect.poll(() => backend.projects.length).toBe(1);
    expect(backend.projects[0]?.name).toBe("Show E2E Mariage");
    expect(Array.isArray(backend.projects[0]?.data.smartPads)).toBe(true);
    expect(Array.isArray(backend.projects[0]?.data.clips)).toBe(true);

    await expect(page.getByText("Show E2E Mariage")).toBeVisible({ timeout: 3000 });

    await page.locator("aside select").first().selectOption("club");
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Generer" }).click();
    await expect(page.getByRole("button", { name: /Scene Warmup blue/i })).toBeVisible();

    await page.getByText("Current Project").click();
    await page.getByTestId("project-row-1").click();

    await expect(page.getByRole("button", { name: /Scene Accueil doux/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Scene Warmup blue/i })).toHaveCount(0);
    await expect(page.locator(".timeline-clip")).toHaveCount(6);
  });
});
