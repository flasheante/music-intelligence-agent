"use client";

import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/health";

type State = "loading" | "up" | "down";

export function ApiStatus() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let active = true;

    fetchHealth()
      .then(() => active && setState("up"))
      .catch(() => active && setState("down"));

    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <p className="text-sm text-neutral-500" role="status">
        Verificando la API…
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm" role="status">
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${state === "up" ? "bg-brand-red" : "bg-neutral-300"}`}
      />
      <span className="text-neutral-700">API y Redis</span>
      <span className="font-medium">{state === "up" ? "ok" : "sin conexión"}</span>
    </p>
  );
}
