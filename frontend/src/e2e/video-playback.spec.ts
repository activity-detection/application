import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

test("opens first recording and plays it to the end", async ({ page }) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    try {
      await expect
        .poll(
          async () => page.locator("tbody tr").first().textContent(),
          { timeout: 60_000 },
        )
        .toContain("...");
      break;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
    }
  }

  const firstRecordingRow = page.locator("tbody tr").first();
  await expect(firstRecordingRow).toBeVisible();
  await firstRecordingRow.click();

  const video = page.locator("video");
  await expect(video).toBeVisible();

  await expect
    .poll(async () => video.evaluate((element) => (element as HTMLVideoElement).duration), {
      timeout: 30_000,
    })
    .toBeGreaterThan(35);
  await expect
    .poll(async () => video.evaluate((element) => (element as HTMLVideoElement).duration), {
      timeout: 30_000,
    })
    .toBeLessThan(37);

  await video.evaluate((element) => {
    const videoElement = element as HTMLVideoElement;
    videoElement.muted = true;
    videoElement.playbackRate = 4;
  });

  await video.evaluate(async (element) => {
    const videoElement = element as HTMLVideoElement;
    await videoElement.play();
  });

  await page.waitForFunction(() => {
    const videoElement = document.querySelector("video") as HTMLVideoElement | null;
    return Boolean(videoElement?.ended);
  }, undefined, { timeout: 25_000 });

  await expect(video).toHaveJSProperty("ended", true);
});
