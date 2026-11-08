import type { AniListMedia, AniListMediaRelationEdge } from "../types";
import { resolveMedia } from "./media-cache";

const MAX_SEASON_HOPS = 25;
const SEASON_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);
const RE_HAS_SEASON_INDICATOR =
  /\b(?:season|saison|part|cour)\s*\d+|\b\d+(?:st|nd|rd|th)\s+season\b|\bfinal\s+season\b/i;

function isMainSeasonNode(
  node: AniListMediaRelationEdge["node"] | null | undefined,
  rootFormat?: string | null
): boolean {
  if (!node) return false;
  if (node.type && node.type !== "ANIME") return false;
  if (node.status === "NOT_YET_RELEASED" || node.status === "CANCELLED") return false;
  if (!node.format) return true;
  if (SEASON_FORMATS.has(node.format)) return true;
  return rootFormat === "OVA" && node.format === "OVA";
}

function findRelationNode(
  media: AniListMedia,
  relationType: "PREQUEL" | "SEQUEL"
): AniListMediaRelationEdge["node"] | null {
  const edges = media.relations?.edges;
  if (!edges || edges.length === 0) return null;

  const candidates = edges
    .filter((edge) => edge.relationType === relationType && isMainSeasonNode(edge.node, media.format))
    .map((edge) => edge.node);

  if (candidates.length === 0) return null;

  return candidates.find((node) => (node.episodes ?? 0) > 1) ?? candidates[0];
}

async function walkSequelsForward(
  startMedia: AniListMedia,
  startProgress: number,
  token: string | null
): Promise<{ media: AniListMedia; progress: number; fits: boolean }> {
  let current = startMedia;
  let progress = startProgress;
  const visited = new Set<number>([current.id]);

  for (let hop = 0; hop < MAX_SEASON_HOPS; hop++) {
    const maxEpisodes = current.episodes;
    if (!maxEpisodes || maxEpisodes <= 0 || progress <= maxEpisodes) {
      return { media: current, progress, fits: true };
    }

    const sequelNode = findRelationNode(current, "SEQUEL");
    if (!sequelNode || visited.has(sequelNode.id)) {
      return { media: current, progress, fits: false };
    }

    const nextProgress = progress - maxEpisodes;
    if (nextProgress <= 0) {
      return { media: current, progress, fits: true };
    }

    visited.add(sequelNode.id);
    const nextMedia = await resolveMedia(sequelNode.id, token);
    if (!nextMedia) {
      return { media: current, progress, fits: false };
    }

    current = nextMedia;
    progress = nextProgress;
  }

  return {
    media: current,
    progress,
    fits: !current.episodes || current.episodes <= 0 || progress <= current.episodes,
  };
}

async function collectPrequelEpisodeCounts(
  startMedia: AniListMedia,
  token: string | null
): Promise<number[]> {
  const counts: number[] = [];
  let current = startMedia;
  const visited = new Set<number>([current.id]);

  for (let hop = 0; hop < MAX_SEASON_HOPS; hop++) {
    const prequelNode = findRelationNode(current, "PREQUEL");
    if (!prequelNode || visited.has(prequelNode.id)) break;

    visited.add(prequelNode.id);
    const prequelMedia = await resolveMedia(prequelNode.id, token);
    const episodes = prequelMedia?.episodes ?? prequelNode.episodes;
    if (!episodes || episodes <= 0) break;

    counts.push(episodes);
    if (!prequelMedia) break;
    current = prequelMedia;
  }

  return counts;
}

export interface ResolvedAnimeSeason {
  media: AniListMedia;
  progress: number;
}

export async function resolveAnimeSeason(
  mediaId: number,
  rawProgress: number,
  detectedTitle: string,
  token: string | null
): Promise<ResolvedAnimeSeason | null> {
  const initialMedia = await resolveMedia(mediaId, token);
  if (!initialMedia) return null;

  if (rawProgress <= 0 || initialMedia.type === "MANGA") {
    return { media: initialMedia, progress: rawProgress };
  }

  const hasPrequel = findRelationNode(initialMedia, "PREQUEL") !== null;
  const hasSeasonInTitle = RE_HAS_SEASON_INDICATOR.test(detectedTitle);

  if (hasPrequel && !hasSeasonInTitle) {
    const prequelCounts = await collectPrequelEpisodeCounts(initialMedia, token);
    const totalPrequelEpisodes = prequelCounts.reduce((sum, count) => sum + count, 0);

    const exceedsInitialEpisodes =
      initialMedia.episodes != null && initialMedia.episodes > 0 && rawProgress > initialMedia.episodes;
    const isContinuousDonghuaOrLongSeason =
      initialMedia.countryOfOrigin === "CN" ||
      (initialMedia.episodes ?? 0) > 50 ||
      initialMedia.episodes == null;

    if (
      totalPrequelEpisodes > 0 &&
      rawProgress > totalPrequelEpisodes &&
      (exceedsInitialEpisodes || isContinuousDonghuaOrLongSeason)
    ) {
      const forward = await walkSequelsForward(
        initialMedia,
        rawProgress - totalPrequelEpisodes,
        token
      );
      return { media: forward.media, progress: forward.progress };
    }
  }

  const forward = await walkSequelsForward(initialMedia, rawProgress, token);
  if (forward.fits || !hasPrequel) {
    return { media: forward.media, progress: forward.progress };
  }

  const prequelCounts = await collectPrequelEpisodeCounts(initialMedia, token);
  let prequelOffset = 0;

  for (const count of prequelCounts) {
    prequelOffset += count;
    const adjustedProgress = rawProgress - prequelOffset;
    if (adjustedProgress < 1) break;

    const candidate = await walkSequelsForward(initialMedia, adjustedProgress, token);
    if (candidate.fits) {
      return { media: candidate.media, progress: candidate.progress };
    }
  }

  return { media: forward.media, progress: forward.progress };
}
