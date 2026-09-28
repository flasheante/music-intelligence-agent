import { Genre } from '../common/enums/genre.enum';
import { Region } from '../common/enums/region.enum';
import { TopStory } from '../common/interfaces/top-story.interface';
import { UnrankedStory } from './story-builder';

export function rankStories(
  stories: UnrankedStory[],
  limit: number,
): TopStory[] {
  return [...stories]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.sourceCount - a.sourceCount ||
        b.lastSeenAt.localeCompare(a.lastSeenAt),
    )
    .slice(0, limit)
    .map((story, index) => ({ rank: index + 1, ...story }));
}

export interface StoryFilter {
  region?: Region;
  genre?: Genre;
}

/**
 * Regional/genre Top N (spec 9, 27): filters the global candidate list and
 * re-numbers ranks within the filtered view.
 */
export function filterStories(
  stories: TopStory[],
  { region, genre }: StoryFilter,
  limit: number,
): TopStory[] {
  return stories
    .filter((story) => !region || story.regions.includes(region))
    .filter((story) => !genre || story.genres.includes(genre))
    .slice(0, limit)
    .map((story, index) => ({ ...story, rank: index + 1 }));
}
