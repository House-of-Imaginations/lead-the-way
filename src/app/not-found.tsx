import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col justify-between bg-background p-05 text-text-primary md:p-07">
      <div className="flex flex-col gap-05">
        <h1 className="text-heading-01">We couldn&apos;t find that page.</h1>
        <Link href="/" className="text-body-02 text-link hover:text-link-hover">
          Go to your home
        </Link>
      </div>
      <p className="text-label-01 text-text-helper">
        Concept prototype. Not an official IBM product.
      </p>
    </main>
  );
}
