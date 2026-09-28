import type { Region, TrendLevel, VerificationStatus } from "@/types/api";

export const TREND_LEVEL_LABELS: Record<TrendLevel, string> = {
  VERY_HIGH: "Muy alta",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export const REGION_LABELS: Record<Region, string> = {
  ARGENTINA: "Argentina",
  USA: "USA",
  EUROPE: "Europa",
  GLOBAL: "Global",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  CONFIRMED: "Confirmado",
  LIKELY: "Probable",
  UNCONFIRMED: "Sin confirmar",
  RUMOR: "Rumor",
};

const STORY_TYPE_LABELS: Record<string, string> = {
  NEW_RELEASE: "Lanzamiento",
  ALBUM: "Disco",
  SINGLE: "Single",
  TOUR: "Gira",
  CONCERT: "Show",
  FESTIVAL: "Festival",
  REUNION: "Reunión",
  COLLABORATION: "Colaboración",
  INTERVIEW: "Entrevista",
  CONTROVERSY: "Polémica",
  AWARD: "Premio",
  CHART: "Rankings",
  DEATH: "Fallecimiento",
  ANNOUNCEMENT: "Anuncio",
  MUSIC_VIDEO: "Videoclip",
  VIRAL: "Viral",
  RUMOR: "Rumor",
  OTHER: "Otro",
};

const GENRE_LABELS: Record<string, string> = {
  HIP_HOP: "Hip hop",
  POST_PUNK: "Post-punk",
  OTHER: "Otro",
};

/** Unknown enum values degrade to a readable string instead of breaking. */
function humanize(value: string): string {
  const lower = value.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function storyTypeLabel(value: string): string {
  return STORY_TYPE_LABELS[value] ?? humanize(value);
}

export function genreLabel(value: string): string {
  return GENRE_LABELS[value] ?? humanize(value);
}

/** 0.82 → "+82%", -0.1 → "-10%". */
export function formatVelocity(velocity: number): string {
  const percent = Math.round(velocity * 100);
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

/** "recién", "hace 5 min", "hace 3 h", "hace 2 días". */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));

  if (minutes < 1) {
    return "recién";
  }

  if (minutes < 60) {
    return `hace ${minutes} min`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `hace ${hours} h`;
  }

  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}
