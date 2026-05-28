interface LocationNameInput {
  title?: unknown;
  regionParts?: unknown[];
  detailParts?: unknown[];
}

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
};

const uniqueTexts = (values: unknown[] = []): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = normalizeText(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }

  return result;
};

const titleRegionIndex = (title: string | null, regionParts: string[]): number => {
  if (!title) return -1;
  return regionParts.findIndex((part) => part === title);
};

export const formatLocationName = ({ title, regionParts = [], detailParts = [] }: LocationNameInput): string | null => {
  const titleText = normalizeText(title);
  const allRegions = uniqueTexts(regionParts);
  const regionEnd = titleRegionIndex(titleText, allRegions);
  const candidateRegions = regionEnd >= 0 ? allRegions.slice(0, regionEnd) : allRegions;
  const regions = candidateRegions.filter((part) => !titleText?.includes(part));
  const details = uniqueTexts(detailParts).filter(
    (part) => !titleText?.includes(part) && !allRegions.some((region) => region === part || region.includes(part)),
  );

  const segments = [titleText, regions.join(''), details.join('')].filter((part): part is string => Boolean(part));
  return segments.length ? segments.join(' · ') : null;
};
