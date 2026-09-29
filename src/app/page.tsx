export default function Home() {
  return (
    <main className="flex min-h-screen flex-col justify-between bg-background p-05 text-text-primary md:p-07">
      <div className="flex flex-col gap-05">
        <h1 className="text-heading-01">Lead the Way</h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">
          One hour of your working week is protected for practical AI learning.
        </p>
      </div>
      <p className="text-label-01 text-text-helper">
        Concept prototype. Not an official IBM product.
      </p>
    </main>
  );
}
