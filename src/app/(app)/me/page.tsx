import { getShell } from "@/lib/account/queries";

// ponytail: P3 shell page, P4/P5/P6 fill the body
export default async function ThisWeekPage() {
  const shell = await getShell();
  return (
    <div className="flex max-w-content-max flex-col gap-07">
      <h1 className="text-heading-01">{shell?.greeting}</h1>
    </div>
  );
}
