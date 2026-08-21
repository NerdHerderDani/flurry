import { expect, test } from "@playwright/test";

test("boots to scanner and tabs work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /FLURRY/ })).toBeVisible();
  // boot log resolves into the tab bar
  await expect(page.getByRole("button", { name: "[F2] GRADUATION" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "[F2] GRADUATION" }).click();
  await expect(page.getByPlaceholder(/queue a mint/)).toBeVisible();
  await page.getByRole("button", { name: "[F3] CONFIG" }).click();
  await expect(page.getByPlaceholder("sk-ant-...")).toBeVisible();
});
