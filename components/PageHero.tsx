// Standard dark hero at the top of every content page.
export default function PageHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  return (
    <section className="bg-slate-900 px-4 py-16 text-center text-white sm:py-20">
      <div className="mx-auto max-w-3xl">
        {eyebrow && (
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{title}</h1>
        {intro && (
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
            {intro}
          </p>
        )}
      </div>
    </section>
  );
}
