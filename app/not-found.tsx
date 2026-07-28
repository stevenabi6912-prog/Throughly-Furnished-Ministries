import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-950 px-4 py-32 text-center text-white">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-400">
          404
        </p>
        <h1 className="mt-3 text-5xl">Page Not Found</h1>
        <p className="mx-auto mt-4 max-w-md text-slate-300">
          That page doesn&rsquo;t exist — it may have moved when the site was
          rebuilt.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Back to the Homepage
        </Link>
      </div>
    </main>
  );
}
