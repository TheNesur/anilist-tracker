export interface MangaDetection {
  title: string;
  chapter: number;
  source: SupportedSite;
  url: string;
}

export type SupportedSite =
  | "asura"
  | "flame"
  | "reaper"
  | "luminous"
  | "raijin"
  | "webtoon";

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

export type MessageType =
  | "MANGA_DETECTED"
  | "UPDATE_PROGRESS"
  | "SEARCH_ANILIST"
  | "GET_AUTH_TOKEN"
  | "GET_PROGRESS"
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

export interface StorageData {
  accessToken: string | null;
  userId: number | null;
  username: string | null;
  titleMappings: Record<string, number>;
  autoUpdate: boolean;
  theme: Theme;
}

export const DEFAULT_STORAGE: StorageData = {
  accessToken: null,
  userId: null,
  username: null,
  titleMappings: {},
  autoUpdate: false,
  theme: "dark",
};

export type Theme = "dark" | "light";

export type PopupState =
  | { type: "unauthenticated" }
  | { type: "loading" }
  | { type: "unsupported_site"; hostname: string }
  | { type: "unsupported_page"; site: SupportedSite }
  | { type: "detection_failed"; site: SupportedSite }
  | { type: "detected"; detection: MangaDetection; progress: number | null; mediaId: number | null; searchResults: AniListMedia[] | null }
  | { type: "error"; message: string };