const STOP = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves also use used using one two three four five make made get got new like way much many will just see lot something things thing people time year years day days back still well good also often`.split(
    /\s+/
  )
);

export function extractKeywords(text: string, n = 8): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3 && t.length < 24 && !STOP.has(t) && !/^\d+$/.test(t));

  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

export function summarize(text: string, sentences = 2): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const parts = clean.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  return parts.slice(0, sentences).join(' ').slice(0, 280);
}
