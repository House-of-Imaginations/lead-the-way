import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandMark";

/**
 * The two front doors, and the only screens in the product that are allowed a
 * picture. Everything past sign-in is a document -- THE FLAT RECORD RULE -- so
 * the decorative background lives here and nowhere else.
 *
 * Centre the form group in the right half on desktop. Mobile artwork is muted
 * behind the form; short screens scroll rather than clipping the sign-up form.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate grid min-h-svh flex-1 grid-cols-1 items-center justify-items-center bg-[#f5eddf] [--input:#b8ad9c] [--well:#fbf7ef] lg:grid-cols-2 dark:bg-background dark:[--input:#526b62] dark:[--well:#0b201b]">
      <div className="flex w-full max-w-[480px] flex-col gap-10 px-5 py-10 sm:px-10 lg:col-start-2">
        <div className="mx-auto flex w-full max-w-[400px] items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-h-[44px] items-center"
            aria-label="Lead the Way"
          >
            <BrandLogo className="[&>svg]:w-[150px]" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
    </main>
  );
}
