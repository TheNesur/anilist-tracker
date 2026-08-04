export type MediaType = "MANGA" | "ANIME";

export interface MediaDetection {
  title: string;
  progress: number;    // chapter for manga, episode for anime
  mediaType: MediaType;
  source: SupportedSite;
  url: string;
}

export type SupportedSite =
  | "asura"
  | "flame"
  | "reaper"
  | "raijin"
  | "webtoon"
  | "mangadex"
  | "mangaplus"
  | "crunchyroll"
  | "voiranime"
  | "anime-sama"
  | "generic";

export interface GenericDetectionResult {
  title: string;
  progress: number;
  url: string;
  possibleTypes: MediaType[];
}

export interface CatalogEntry {
  element: HTMLElement;
  title: string;
  latestChapter: number;
  url: string;
}

export interface CatalogParser {
  site: SupportedSite;
  isCatalogPage(): boolean;
  detectEntries(): CatalogEntry[];
}

export interface AniListMedia {
  id: number;
  title: { romaji: string; english: string | null; native: string | null; };
  synonyms?: string[];
  coverImage: { medium: string };
  siteUrl: string;
}

export interface AniListMediaList {
  id: number;
  progress: number;
  status: string;
  media: AniListMedia;
}

export type MessageType =
  | "MEDIA_DETECTED"
  | "UPDATE_PROGRESS"
  | "SEARCH_ANILIST"
  | "GET_AUTH_TOKEN"
  | "GET_PROGRESS"
  | "AUTH_SUCCESS"
  | "LOCAL_UPDATE_PROGRESS"
  | "ALIAS_SUBMIT"
  | "GET_PROGRESS_CACHE"
  | "FLUSH_PENDING_UPDATES";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface MediaDetectedMessage extends ExtensionMessage {
  type: "MEDIA_DETECTED";
  payload: MediaDetection;
}

export interface UpdateProgressMessage extends ExtensionMessage {
  type: "UPDATE_PROGRESS";
  payload: {
    mediaId: number;
    progress: number;
    mediaType: MediaType;
  };
}

export interface PendingUpdate {
  mediaId: number;
  progress: number;
  mediaType: MediaType;
  queuedAt: number;
}

export interface StorageData {
  accessToken: string | null;
  userId: number | null;
  username: string | null;
  titleMappings: Record<string, number>;
  autoUpdate: boolean;
  autoMap: boolean;
  theme: Theme;
  contributeAliases: boolean;
  showCatalogStatus: boolean;
  mangaProgressCache: Record<number, number>;
  mangaProgressCacheUpdatedAt: number | null;
  pendingUpdates: PendingUpdate[];
}

export const DEFAULT_STORAGE: StorageData = {
  accessToken: null,
  userId: null,
  username: null,
  titleMappings: {},
  autoUpdate: false,
  autoMap: false,
  theme: "dark",
  contributeAliases: false,
  showCatalogStatus: false,
  mangaProgressCache: {},
  mangaProgressCacheUpdatedAt: null,
  pendingUpdates: [],
};

export type Theme = "dark" | "light";

export type PopupState =
  | { type: "unauthenticated" }
  | { type: "loading" }
  | { type: "unsupported_site"; hostname: string }
  | { type: "unsupported_page"; site: SupportedSite }
  | { type: "detection_failed"; site: SupportedSite }
  | { type: "generic_type_pick"; candidate: GenericDetectionResult; hostname: string }
  | { type: "detected"; detection: MediaDetection; progress: number | null; media: AniListMedia | null; searchResults: AniListMedia[] | null }
  | { type: "searching"; preview: { title: string; progress: number; mediaType: MediaType } | null }
  | { type: "error"; message: string };

export class TokenExpiredError extends Error {
  readonly name = "TokenExpiredError" as const;
  constructor(message = "AniList access token expired or invalid") {
    super(message);
  }
}

export function isTokenExpiredError(err: unknown): err is TokenExpiredError {
  return err instanceof TokenExpiredError;
}

export class AniListUnreachableError extends Error {
  readonly name = "AniListUnreachableError" as const;
  constructor(message = "AniList is currently unreachable") {
    super(message);
  }
}

export function isAniListUnreachableError(err: unknown): err is AniListUnreachableError {
  return err instanceof AniListUnreachableError;
}