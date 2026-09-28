"use client";

import { useCallback, useEffect, useState } from "react";
import { RegionFilter, type RegionFilterValue } from "@/components/RegionFilter";
import { StoryCard } from "@/components/StoryCard";
import { formatRelative } from "@/lib/format";
import { fetchTop } from "@/lib/top";
import type { TopStoriesSnapshot } from "@/types/api";

/** Well under the fastest collection cadence (15 min), so updates show up promptly. */
const REFRESH_MS = 60_000;

type State =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: TopStoriesSnapshot }
  | { kind: "error" };

export function TopStories() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [region, setRegion] = useState<RegionFilterValue>("ALL");

  const load = useCallback(async () => {
    try {
      const snapshot = await fetchTop(region === "ALL" ? undefined : region);
      setState({ kind: "ready", snapshot });
    } catch {
      // Keep showing the last good ranking if a background refresh fails.
      setState((previous) => (previous.kind === "ready" ? previous : { kind: "error" }));
    }
  }, [region]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) {
        void load();
      }
    };

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Ranking actual
          </h2>
          {state.kind === "ready" && state.snapshot.generatedAt && (
            <p className="mt-1 text-sm text-neutral-600">
              Actualizado {formatRelative(state.snapshot.generatedAt)}
            </p>
          )}
        </div>
        <RegionFilter value={region} onChange={setRegion} />
      </div>

      <TopStoriesBody state={state} region={region} onRetry={() => void load()} />
    </section>
  );
}

type TopStoriesBodyProps = {
  state: State;
  region: RegionFilterValue;
  onRetry: () => void;
};

function TopStoriesBody({ state, region, onRetry }: TopStoriesBodyProps) {
  if (state.kind === "loading") {
    return (
      <p role="status" className="text-sm text-neutral-600">
        Cargando el ranking…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-6">
        <p className="text-sm text-neutral-800">
          No pudimos cargar el ranking. Revisá que el backend esté corriendo.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="w-fit rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-brand-white transition-opacity hover:opacity-90"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { stories, generatedAt } = state.snapshot;

  if (stories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
        {generatedAt || region !== "ALL"
          ? "No hay historias en el ranking para esta región."
          : "Todavía no hay ranking publicado. Va a aparecer acá después de la primera corrida del análisis de tendencias."}
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {stories.map((story) => (
        <li key={story.id}>
          <StoryCard story={story} />
        </li>
      ))}
    </ol>
  );
}
