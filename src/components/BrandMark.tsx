/** The 24px blue square with the white stair path. */
export function BrandMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect width="24" height="24" fill="var(--color-primary, #0f62fe)" />
      <path
        d="M5 18h4.5v-4.5H14V9h5"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      />
    </svg>
  );
}

/** Mark and wordmark, for auth, status and offline screens. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <BrandMark className="size-6" />
      <span className="text-[15px] font-semibold">Lead the Way</span>
    </span>
  );
}
