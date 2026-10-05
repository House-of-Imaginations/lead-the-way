// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { VideoPlayer } from "../../../../src/components/ui";

const track = (captionsOn: boolean) =>
  /<track[^>]*>/.exec(
    renderToStaticMarkup(
      <VideoPlayer
        src="/v.mp4"
        captions="/c.vtt"
        label="Clip"
        captionsOn={captionsOn}
      />,
    ),
  )?.[0];

test("the caption track is default only when captions are on", () => {
  expect(track(true)).toMatch(/\bdefault\b/);
  expect(track(false)).not.toMatch(/\bdefault\b/);
});
