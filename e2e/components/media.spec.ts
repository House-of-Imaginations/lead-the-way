import { expect, test } from "../fixtures";
import { PATHWAY_MODULES } from "../../convex/lib/pathway";
import { THEMES, TOKENS, gallery } from "./helpers";

const FIRST_CUE = "Placeholder captions. The final video is on its way.";

test("each module has placeholder captions and the clip is served", async ({
  page,
}) => {
  const clip = await page.request.get("/pathway/placeholder.mp4");
  expect(clip.status()).toBe(200);
  expect(clip.headers()["content-type"]).toBe("video/mp4");
  for (const { key } of PATHWAY_MODULES) {
    const res = await page.request.get(`/pathway/${key}.vtt`);
    expect(res.status(), key).toBe(200);
    expect(res.headers()["content-type"], key).toMatch(/^text\/vtt/);
    const body = await res.text();
    expect(body.startsWith("WEBVTT\n"), key).toBe(true);
    expect(body, key).toContain(FIRST_CUE);
    expect(body.match(/-->/g), key).toHaveLength(3);
  }
});

for (const theme of THEMES) {
  test.describe(`media, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(gallery(theme));
    });

    test("video has captions on by default", async ({ page }) => {
      const video = page.locator("#media video");
      await expect(video).toHaveAttribute(
        "aria-label",
        "Why your team needs shared AI norms",
      );
      await expect(video).toHaveAttribute("controls", "");
      await expect(video).toHaveAttribute("preload", "metadata");
      const track = video.locator("track");
      await expect(track).toHaveAttribute("kind", "captions");
      await expect(track).toHaveAttribute("srclang", "en");
      await expect(track).toHaveAttribute("label", "English");
      await expect(track).toHaveAttribute("default", "");
      // Playwright's Chromium has no H.264 decoder. That's fine: a default
      // track is selected and loaded when it is added, not when the video plays.
      await expect
        .poll(() =>
          video.evaluate((v: HTMLVideoElement) => v.textTracks[0]?.mode),
        )
        .toBe("showing");
      await expect
        .poll(() =>
          video.evaluate(
            (v: HTMLVideoElement) =>
              (v.textTracks[0]?.cues?.[0] as VTTCue | undefined)?.text ?? null,
          ),
        )
        .toBe(FIRST_CUE);
    });

    test("the video frame is square and tokened", async ({ page }) => {
      const frame = page.locator("#media .ltw-video");
      const video = page.locator("#media video");
      await expect(frame).toHaveCSS("background-color", TOKENS[theme].layer01);
      await expect(frame).toHaveCSS("border-top-left-radius", "0px");
      await expect(video).toHaveCSS("border-top-left-radius", "0px");
      const f = (await frame.boundingBox())!;
      expect(Math.abs(f.width / f.height - 16 / 9)).toBeLessThan(0.01);
      expect(await video.boundingBox()).toEqual(f);
    });

    test("media passes axe", async ({ page, expectAxeClean }) => {
      await expectAxeClean(page, "#media");
    });
  });
}
