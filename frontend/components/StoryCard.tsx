import {
  REGION_LABELS,
  TREND_LEVEL_LABELS,
  VERIFICATION_LABELS,
  formatRelative,
  formatVelocity,
  genreLabel,
  storyTypeLabel,
} from "@/lib/format";
import type { TopStory, VerificationStatus } from "@/types/api";

/** Status is always spelled out, so these styles never carry meaning alone. */
const verificationClass: Record<VerificationStatus, string> = {
  CONFIRMED: "bg-brand-black text-brand-white",
  LIKELY: "border border-brand-black text-brand-black",
  UNCONFIRMED: "border border-neutral-300 text-neutral-600",
  RUMOR: "border border-brand-red text-brand-red",
};

type StoryCardProps = {
  story: TopStory;
};

export function StoryCard({ story }: StoryCardProps) {
  const score = Math.max(0, Math.min(10, story.score));
  const isPodium = story.rank <= 3;

  return (
    <article className="flex gap-4 rounded-xl border border-neutral-200 p-5 sm:gap-6 sm:p-6">
      <span
        aria-label={`Puesto ${story.rank}`}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold text-brand-white sm:h-12 sm:w-12 sm:text-lg ${
          isPodium ? "bg-brand-red" : "bg-brand-black"
        }`}
      >
        {story.rank}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className="text-brand-red">{storyTypeLabel(story.type)}</span>
          {story.genres.map((genre) => (
            <span key={genre} className="flex items-center gap-2 text-neutral-500">
              <span aria-hidden className="text-neutral-300">
                /
              </span>
              {genreLabel(genre)}
            </span>
          ))}
          <span
            className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${verificationClass[story.verificationStatus]}`}
          >
            {VERIFICATION_LABELS[story.verificationStatus]}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-semibold leading-snug text-brand-black">{story.title}</h3>
          {story.artists.length > 0 && (
            <p className="mt-0.5 text-sm font-medium text-neutral-700">
              {story.artists.join(", ")}
            </p>
          )}
          {story.summary && <p className="mt-2 text-sm text-neutral-600">{story.summary}</p>}
        </div>

        <div className="flex items-center gap-3">
          <div
            role="meter"
            aria-label={`Tendencia ${TREND_LEVEL_LABELS[story.trendLevel].toLowerCase()}`}
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={score}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200"
          >
            <div className="h-full rounded-full bg-brand-red" style={{ width: `${score * 10}%` }} />
          </div>
          <span className="w-10 text-right text-sm font-semibold tabular-nums">
            {score.toFixed(1)}
          </span>
        </div>

        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-600">
          <div className="flex gap-1">
            <dt>Tendencia</dt>
            <dd className="font-medium text-brand-black">
              {TREND_LEVEL_LABELS[story.trendLevel]}
            </dd>
          </div>
          {story.velocity !== 0 && (
            <div className="flex gap-1">
              <dt>Velocidad</dt>
              <dd
                className={`font-medium tabular-nums ${story.velocity > 0 ? "text-brand-red" : "text-brand-black"}`}
              >
                {formatVelocity(story.velocity)}
              </dd>
            </div>
          )}
          <div className="flex gap-1">
            <dt>Fuentes</dt>
            <dd className="font-medium tabular-nums text-brand-black">{story.sourceCount}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="sr-only">Regiones</dt>
            <dd className="font-medium text-brand-black">
              {story.regions.map((region) => REGION_LABELS[region] ?? region).join(" · ")}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="sr-only">Última cobertura</dt>
            <dd>{formatRelative(story.lastSeenAt)}</dd>
          </div>
        </dl>

        {story.sources.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {story.sources.map((source) => (
              <li key={source.name}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:border-brand-red hover:text-brand-red"
                >
                  {source.name} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
