export type MediaType = "MANGA" | "ANIME";

export type Theme = "dark" | "light";

export interface MediaDetection {
  title: string;
  progress: number;
  mediaType: MediaType;
  source: SupportedSite;
  url: string;
}

export type SupportedSite =
  | "asura"
  | "flame"
  | "reaper"
  | "raijin"
  | "aniverse"
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
  type?: MediaType;
  format?: string | null;
  countryOfOrigin?: string | null;
  title: { romaji: string; english: string | null; native: string | null };
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

export interface AliasSubmitPayload {
  alias: string;
  mediaType: MediaType;
  mediaId: number;
  mediaTitle: string;
  sourceHostname: string | null;
}

export type ReportKind = "wrong_match" | "not_found" | "site_not_working" | "other";

export type ReportContextName =
  | "detected"
  | "results"
  | "no_results"
  | "detection_failed"
  | "unsupported_page"
  | "unsupported_site";

export interface AliasReportPayload {
  alias: string;
  mediaType: MediaType;
  mediaId: number;
  mediaTitle: string;
  sourceHostname: string | null;
  kind: "wrong_match" | "other";
  note: string | null;
}

export interface FeedbackReportPayload {
  kind: "not_found" | "site_not_working" | "other";
  context: ReportContextName;
  hostname: string;
  title: string | null;
  mediaType: MediaType | null;
  note: string | null;
}

export interface PendingUpdate {
  mediaId: number;
  progress: number;
  mediaType: MediaType;
  queuedAt: number;
  attempts?: number;
}

export interface UpdateResult {
  success: boolean;
  progress?: number;
  current?: number;
  skipped?: boolean;
  queued?: boolean;
  error?: string;
}

export interface OAuthResult {
  success: boolean;
  username?: string | null;
  partial?: boolean;
  cancelled?: boolean;
  timedOut?: boolean;
  error?: string;
}

export type MessageType =
  | "MEDIA_DETECTED"
  | "DETECTION_FAILED"
  | "UPDATE_PROGRESS"
  | "SEARCH_ANILIST"
  | "START_OAUTH"
  | "GET_PROGRESS"
  | "LOCAL_UPDATE_PROGRESS"
  | "ALIAS_SUBMIT"
  | "ALIAS_REPORT"
  | "FEEDBACK_REPORT"
  | "GET_PROGRESS_CACHE"
  | "FLUSH_PENDING_UPDATES"
  | "RETRY_DETECTION"
  | "REDETECT";

export type Message =
  | { type: "MEDIA_DETECTED"; payload: MediaDetection; tabId?: number }
  | { type: "DETECTION_FAILED"; url: string }
  | { type: "UPDATE_PROGRESS"; payload: { mediaId: number; progress: number; mediaType: MediaType } }
  | { type: "SEARCH_ANILIST"; payload: { title: string; mediaType: MediaType } }
  | { type: "START_OAUTH" }
  | { type: "GET_PROGRESS"; payload: { mediaId: number } }
  | { type: "LOCAL_UPDATE_PROGRESS"; payload: { progress: number } }
  | { type: "ALIAS_SUBMIT"; payload: AliasSubmitPayload }
  | { type: "ALIAS_REPORT"; payload: AliasReportPayload }
  | { type: "FEEDBACK_REPORT"; payload: FeedbackReportPayload }
  | { type: "GET_PROGRESS_CACHE"; payload: { mediaType: MediaType } }
  | { type: "FLUSH_PENDING_UPDATES" }
  | { type: "RETRY_DETECTION"; tabId: number }
  | { type: "REDETECT" };

export interface Settings {
  autoUpdate: boolean;
  autoMap: boolean;
  theme: Theme;
  contributeAliases: boolean;
  showCatalogStatus: boolean;
  showUpdatePage: boolean;
  showBetaFeatures: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoUpdate: false,
  autoMap: false,
  theme: "dark",
  contributeAliases: false,
  showCatalogStatus: false,
  showUpdatePage: false,
  showBetaFeatures: false,
};

export interface AccountData {
  accessToken: string | null;
  userId: number | null;
  username: string | null;
  tokenExpired: boolean;
}

export const DEFAULT_ACCOUNT: AccountData = {
  accessToken: null,
  userId: null,
  username: null,
  tokenExpired: false,
};

export interface StorageData extends Settings, AccountData {
  titleMappings: Record<string, number>;
  legacyTitleMappings: Record<string, number>;
  mangaProgressCache: Record<number, number>;
  mangaProgressCacheUpdatedAt: number | null;
  pendingUpdates: PendingUpdate[];
  pendingRetryMinutes: number;
  schemaVersion: number;
}

export const DEFAULT_STORAGE: StorageData = {
  ...DEFAULT_SETTINGS,
  ...DEFAULT_ACCOUNT,
  titleMappings: {},
  legacyTitleMappings: {},
  mangaProgressCache: {},
  mangaProgressCacheUpdatedAt: null,
  pendingUpdates: [],
  pendingRetryMinutes: 5,
  schemaVersion: 0,
};

export interface SessionData {
  viewerFetchFailed: boolean;
  pendingUpdateErrorCount: number;
}

export const DEFAULT_SESSION: SessionData = {
  viewerFetchFailed: false,
  pendingUpdateErrorCount: 0,
};

export type PopupState =
  | { type: "unauthenticated" }
  | { type: "loading" }
  | { type: "unsupported_site"; hostname: string }
  | { type: "unsupported_page"; site: SupportedSite; hostname: string }
  | { type: "detection_failed"; site: SupportedSite; hostname: string }
  | { type: "generic_type_pick"; candidate: GenericDetectionResult; hostname: string }
  | { type: "detected"; detection: MediaDetection; progress: number | null; media: AniListMedia | null; searchResults: AniListMedia[] | null; isManualMatch: boolean }
  | { type: "searching"; preview: { title: string; progress: number; mediaType: MediaType } | null }
  | { type: "token_expired" }
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
