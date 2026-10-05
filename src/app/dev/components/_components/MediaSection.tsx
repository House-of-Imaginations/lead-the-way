import { VideoPlayer } from "@/components/ui/VideoPlayer";
import { Section } from "./Section";

export function MediaSection() {
  return (
    <Section id="media" title="Video">
      {/* 05's player column width. */}
      <div className="max-w-[570px]">
        <VideoPlayer
          src="/pathway/placeholder.mp4"
          captions="/pathway/shared-norms.vtt"
          label="Why your team needs shared AI norms"
        />
      </div>
    </Section>
  );
}
