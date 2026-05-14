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
  | "anime-sama";

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
  | "AUTH_SUCCESS";

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

export interface StorageData {
  accessToken: string | null;
  userId: number | null;
  username: string | null;
  titleMappings: Record<string, number>;
  autoUpdate: boolean;
  autoMap: boolean;
  theme: Theme;
}

export const DEFAULT_STORAGE: StorageData = {
  accessToken: null,
  userId: null,
  username: null,
  titleMappings: {},
  autoUpdate: false,
  autoMap: false,
  theme: "dark",
};

export type Theme = "dark" | "light";

export type PopupState =
  | { type: "unauthenticated" }
  | { type: "loading" }
  | { type: "unsupported_site"; hostname: string }
  | { type: "unsupported_page"; site: SupportedSite }
  | { type: "detection_failed"; site: SupportedSite }
  | { type: "detected"; detection: MediaDetection; progress: number | null; media: AniListMedia | null; searchResults: AniListMedia[] | null }
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