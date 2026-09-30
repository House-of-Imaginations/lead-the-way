import { expect, test } from "vitest";
import { vttText } from "@/lib/vtt";

test("vttText keeps only the cue text", () => {
  const vtt = [
    "WEBVTT",
    "",
    "NOTE for editors, never shown",
    "",
    "1",
    "00:00:00.000 --> 00:00:03.500",
    "Placeholder captions. The final video is on its way.",
    "",
    "intro-2",
    "00:00:03.500 --> 00:00:07.000 align:start",
    "<v Priya>Two lines</v>",
    "of <i>one</i> cue.",
    "",
    "00:00:07.000 --> 00:00:10.000",
    "Tom &amp; Jerry &lt;b&gt;",
    "",
  ].join("\r\n");
  expect(vttText(vtt)).toEqual([
    "Placeholder captions. The final video is on its way.",
    "Two lines of one cue.",
    // Decoded after the tags are stripped: text for React to escape, never markup.
    "Tom & Jerry <b>",
  ]);
  expect(vttText("WEBVTT\n")).toEqual([]);
});
