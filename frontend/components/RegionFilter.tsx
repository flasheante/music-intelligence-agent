import { REGION_LABELS } from "@/lib/format";
import type { Region } from "@/types/api";

export type RegionFilterValue = Region | "ALL";

const OPTIONS: RegionFilterValue[] = ["ALL", "ARGENTINA", "USA", "EUROPE"];

type RegionFilterProps = {
  value: RegionFilterValue;
  onChange: (value: RegionFilterValue) => void;
};

export function RegionFilter({ value, onChange }: RegionFilterProps) {
  return (
    <div role="radiogroup" aria-label="Región" className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={`rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red ${
            option === value
              ? "border-brand-red text-brand-red"
              : "border-neutral-300 text-neutral-700 hover:border-neutral-400"
          }`}
        >
          {option === "ALL" ? "Todas" : REGION_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
