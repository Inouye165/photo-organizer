import { expect, test } from "@playwright/test";

test("can trigger a scan and view real photos in the gallery", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("No photos matched this view.")).toBeVisible();

  await page.getByRole("button", { name: "Run full library scan" }).click();

  await expect(page.getByText("beach.jpg")).toBeVisible();
  await expect(page.getByText("mountain.jpg")).toBeVisible();
  await expect(page.getByTestId("total-photos-card")).toContainText("2");
  await expect(page.getByTestId("filtered-photos-card")).toContainText("2");
});
