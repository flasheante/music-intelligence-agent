import { Region } from '../common/enums/region.enum';
import { clusterItems } from './clustering';
import { analyzeItem } from './entities';

let counter = 0;
function analyzed(
  source: string,
  title: string,
  tags: string[] = [],
  hoursAgo = 1,
) {
  counter++;
  return analyzeItem({
    source,
    sourceType: 'news',
    title,
    url: `https://example.com/${counter}`,
    publishedAt: new Date(Date.UTC(2026, 8, 28, 12 - hoursAgo)),
    region: Region.USA,
    tags,
  });
}

const options = { windowHours: 48 };

describe('clusterItems', () => {
  it('merges coverage of the same event across outlets and languages', () => {
    const clusters = clusterItems(
      [
        analyzed(
          'Rolling Stone',
          'Slipknot Plan (Sic)est Stadium Tour for Summer 2027',
        ),
        analyzed('Consequence', 'Slipknot Announce Summer 2027 Stadium Tour'),
        analyzed('NME', 'Slipknot announce 2027 ‘(sic)est Stadium Tour’'),
        analyzed(
          'Billboard Argentina',
          'Slipknot vuelve a la Argentina con Marilyn Manson',
          ['SLIPKNOT'],
        ),
      ],
      options,
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0].id).toBe('slipknot-tour');
    expect(clusters[0].items).toHaveLength(4);
  });

  it('keeps different stories about the same event apart', () => {
    const clusters = clusterItems(
      [
        analyzed(
          'Stereogum',
          'VMAs 2026: Nirvana Receive The Video Vanguard Award',
          ['VMAs', 'Nirvana'],
        ),
        analyzed(
          'Consequence',
          'Taylor Swift Dedicates VMAs Video of the Year Award to Dolly Parton',
          ['VMAs', 'Taylor Swift'],
        ),
        analyzed(
          'Pitchfork',
          'Watch Kacey Musgraves Sing Dolly Parton’s Song at the 2026 VMAs',
          ['VMAs'],
        ),
      ],
      options,
    );

    expect(clusters).toHaveLength(3);
  });

  it('does not merge a story where the shared artist is only a guest', () => {
    const clusters = clusterItems(
      [
        analyzed(
          'Pitchfork',
          'Sabrina Carpenter to Play Ginger Rogers in Biopic',
          ['Sabrina Carpenter'],
        ),
        analyzed(
          'Stereogum',
          'Madonna Opens The Show, Joined By Sabrina Carpenter',
          ['Madonna', 'Sabrina Carpenter'],
        ),
      ],
      options,
    );

    expect(clusters).toHaveLength(2);
  });

  it('does not merge items outside the time window', () => {
    const clusters = clusterItems(
      [
        analyzed('NME', 'Slipknot Announce 2027 Stadium Tour', [], 1),
        analyzed('Loudwire', 'Slipknot Announce 2027 Stadium Tour', [], 60),
      ],
      options,
    );

    expect(clusters).toHaveLength(2);
  });

  it('gives colliding ids a suffix', () => {
    const clusters = clusterItems(
      [
        analyzed('NME', 'Oasis Announce Stadium Tour', [], 1),
        analyzed('Loudwire', 'Oasis Announce Stadium Tour', [], 60),
      ],
      options,
    );

    expect(clusters.map((c) => c.id).sort()).toEqual([
      'oasis-tour',
      'oasis-tour-2',
    ]);
  });
});
