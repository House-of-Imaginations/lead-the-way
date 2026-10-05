export type VideoPlayerProps = {
  src: string;
  captions: string;
  label: string;
  captionsOn?: boolean;
};

/**
 * The native player with English captions on by default (Ruling 22), in a
 * square layer-01 frame at 16:9. Every module shares the placeholder clip,
 * so the captions file is the key: a new module gets a fresh element and track.
 * `captionsOn` is the person's Turn captions on by default setting (P7b-1).
 */
export function VideoPlayer({
  src,
  captions,
  label,
  captionsOn = true,
}: VideoPlayerProps) {
  return (
    <div className="ltw-video">
      <video
        key={`${captions}:${captionsOn}`}
        controls
        preload="metadata"
        src={src}
        aria-label={label}
      >
        <track
          kind="captions"
          src={captions}
          srcLang="en"
          label="English"
          default={captionsOn}
        />
      </video>
    </div>
  );
}
