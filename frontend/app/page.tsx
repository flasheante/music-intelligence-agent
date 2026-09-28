import { ApiStatus } from "@/components/ApiStatus";
import { TopStories } from "@/components/TopStories";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center rounded-full bg-brand-black px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-white">
          En tiempo real
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Music Intelligence <span className="text-brand-red">Top 10</span>
        </h1>
        <p className="max-w-xl text-base text-neutral-700">
          Las historias de música más comentadas ahora mismo en Argentina, USA y Europa.
          Cada historia agrupa toda la cobertura del mismo hecho.
        </p>
        <ApiStatus />
      </header>

      <TopStories />
    </main>
  );
}
