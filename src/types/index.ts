// ── Detected manga info from a reading page ──
export interface MangaDetection {
  /** Title as found on the page */
  title: string;
  /** Current chapter number */
  chapter: number;
  /** Source site identifier */
  source: SupportedSite;
  /** URL of the page */
  url: string;
}

// ── Supported scan sites ──
export type SupportedSite =
  | "asura"
  | "flame"
  | "reaper"
  | "luminous"
  | "raijin";

// ── AniList types ──
export interface AniListMedia {
  id: number;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    medium: string;
  };
  siteUrl: string;
}

export interface AniListMediaList {
  id: number;
  progress: number;
  status: string;
  media: AniListMedia;
}

// ── Chrome message passing ──
export type MessageType =
  | "MANGA_DETECTED"
  | "UPDATE_PROGRESS"
  | "SEARCH_ANILIST"
  | "GET_AUTH_TOKEN"
  | "AUTH_SUCCESS";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface MangaDetectedMessage extends ExtensionMessage {
  type: "MANGA_DETECTED";
  payload: MangaDetection;
}

export interface UpdateProgressMessage extends ExtensionMessage {
  type: "UPDATE_PROGRESS";
  payload: {
    mediaId: number;
    chapter: number;
  };
}

// ── Storage schema ──
export interface StorageData {
  /** AniList OAuth access token */
  accessToken: string | null;
  /** AniList user ID */
  userId: number | null;
  /** Manual title mappings: site title → AniList media ID */
  titleMappings: Record<string, number>;
  /** Whether to auto-update without confirmation */
  autoUpdate: boolean;
}

export const DEFAULT_STORAGE: StorageData = {
  accessToken: null,
  userId: null,
  titleMappings: {},
  autoUpdate: false,
};
