"use client";

import { useCallback, useEffect, useState } from "react";
import { RegionFilter, type RegionFilterValue } from "@/components/RegionFilter";
import { StoryCard } from "@/components/StoryCard";
import { formatRelative } from "@/lib/format";
import { formatWait, includesRefresh, requestRefresh } from "@/lib/refresh";
import { fetchTop } from "@/lib/top";
import type { TopStoriesSnapshot } from "@/types/api";

/** Well under the fastest collection cadence (15 min), so updates show up promptly. */
const REFRESH_MS = 60_000;
/** While a requested pipeline run is in progress, check for its ranking more often. */
const WAITING_POLL_MS = 10_000;
/** A GitHub Actions run usually takes 1-2 min, plus queueing; give up waiting after this. */
const WAITING_TIMEOUT_MS = 6 * 60_000;

type RefreshState =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "waiting"; requestedAt: string }
  | { kind: "done" }
  | { kind: "cooldown"; retryAfterSeconds: number }
  | { kind: "timeout" }
  | { kind: "error" };

type State =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: TopStoriesSnapshot }
  | { kind: "error" };

export function TopStories() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [region, setRegion] = useState<RegionFilterValue>("ALL");
  const [refresh, setRefresh] = useState<RefreshState>({ kind: "idle" });
  const generatedAt = state.kind === "ready" ? state.snapshot.generatedAt : null;

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

  // While waiting for a requested run: poll faster, and stop when its ranking
  // shows up (generatedAt moves past requestedAt) or the run takes too long.
  const arrived = refresh.kind === "waiting" && includesRefresh(generatedAt, refresh.requestedAt);
  const refreshView: RefreshState = arrived ? { kind: "done" } : refresh;
  const waitingFor = refreshView.kind === "waiting" ? refreshView.requestedAt : null;

  useEffect(() => {
    if (!waitingFor) {
      return;
    }

    const deadline = new Date(waitingFor).getTime() + WAITING_TIMEOUT_MS;
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        setRefresh({ kind: "timeout" });
      } else {
        void load();
      }
    }, WAITING_POLL_MS);

    return () => clearInterval(timer);
  }, [waitingFor, load]);

  const startRefresh = useCallback(async () => {
    setRefresh({ kind: "requesting" });
    try {
      const result = await requestRefresh();
      const requestedAt = result.requestedAt;

      if (result.status === "started" && requestedAt) {
        setRefresh({ kind: "waiting", requestedAt });
      } else if (
        // Someone else's refresh is still running: wait for it instead.
        requestedAt &&
        !includesRefresh(generatedAt, requestedAt) &&
        Date.now() < new Date(requestedAt).getTime() + WAITING_TIMEOUT_MS
      ) {
        setRefresh({ kind: "waiting", requestedAt });
      } else {
        setRefresh({ kind: "cooldown", retryAfterSeconds: result.retryAfterSeconds });
      }
    } catch {
      setRefresh({ kind: "error" });
    }
  }, [generatedAt]);

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
        <div className="flex flex-wrap items-center gap-3">
          <RegionFilter value={region} onChange={setRegion} />
          <RefreshButton state={refreshView} onClick={() => void startRefresh()} />
        </div>
      </div>

      <RefreshMessage state={refreshView} />

      <TopStoriesBody state={state} region={region} onRetry={() => void load()} />
    </section>
  );
}

function RefreshButton({ state, onClick }: { state: RefreshState; onClick: () => void }) {
  const busy = state.kind === "requesting" || state.kind === "waiting";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-md bg-brand-black px-4 py-2 text-sm font-semibold text-brand-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Actualizando…" : "Actualizar"}
    </button>
  );
}

function RefreshMessage({ state }: { state: RefreshState }) {
  const message = refreshMessage(state);
  if (!message) {
    return null;
  }

  return (
    <p role="status" className="-mt-2 text-sm text-neutral-600">
      {message}
    </p>
  );
}

function refreshMessage(state: RefreshState): string | null {
  switch (state.kind) {
    case "idle":
      return null;
    case "requesting":
      return "Pidiendo las últimas novedades…";
    case "waiting":
      return "Buscando novedades en todas las fuentes. Tarda un par de minutos; el ranking se actualiza solo.";
    case "done":
      return "Listo: el ranking ya incluye las últimas novedades.";
    case "cooldown":
      return `Las novedades se actualizaron hace poco. Podés volver a pedirlas en ${formatWait(state.retryAfterSeconds)}.`;
    case "timeout":
      return "La actualización está tardando más de lo esperado. El ranking se va a actualizar solo cuando termine.";
    case "error":
      return "No pudimos pedir la actualización. Probá de nuevo en unos minutos.";
  }
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
          No pudimos cargar el ranking. Probá de nuevo en unos minutos.
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
