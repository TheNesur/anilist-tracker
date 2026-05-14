import { TokenExpiredError, type AniListMedia, type AniListMediaList } from "../types";

const ANILIST_API = "https://graphql.anilist.co";
const SEARCH_PER_PAGE = 10;
const MAX_RETRIES_429 = 3;
const DEFAULT_RETRY_AFTER_MS = 60_000;

const MANGA_FORMATS = ["MANGA", "ONE_SHOT"];
const ANIME_FORMATS = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA"];

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string | null,
  retryCount = 0
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401) {
    throw new TokenExpiredError();
  }

  if (res.status === 429) {
    if (retryCount >= MAX_RETRIES_429) {
      throw new Error("AniList rate limit: max retries exceeded");
    }
    const retryAfter = Number(res.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : DEFAULT_RETRY_AFTER_MS;
    await sleep(waitMs);
    return gqlRequest<T>(query, variables, token, retryCount + 1);
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(json.errors[0]?.message ?? "AniList API error");
  }

  return json.data as T;
}

const SEARCH_MANGA = `
query ($search: String, $perPage: Int, $formats: [MediaFormat]) {
  Page(perPage: $perPage) {
    media(search: $search, type: MANGA, format_in: $formats, sort: SEARCH_MATCH) {
      id
      format
      countryOfOrigin
      title { romaji english native }
      synonyms
      coverImage { medium }
      siteUrl
    }
  }
}`;

export async function searchManga(title: string): Promise<AniListMedia[]> {
  const data = await gqlRequest<{ Page: { media: AniListMedia[] } }>(
    SEARCH_MANGA,
    { search: title, perPage: SEARCH_PER_PAGE, formats: MANGA_FORMATS }
  );
  return data.Page.media;
}

const SEARCH_ANIME = `
query ($search: String, $perPage: Int, $formats: [MediaFormat]) {
  Page(perPage: $perPage) {
    media(search: $search, type: ANIME, format_in: $formats, sort: SEARCH_MATCH) {
      id
      format
      title { romaji english native }
      synonyms
      coverImage { medium }
      siteUrl
    }
  }
}`;

export async function searchAnime(title: string): Promise<AniListMedia[]> {
  const data = await gqlRequest<{ Page: { media: AniListMedia[] } }>(
    SEARCH_ANIME,
    { search: title, perPage: SEARCH_PER_PAGE, formats: ANIME_FORMATS }
  );
  return data.Page.media;
}

const GET_MEDIA_BY_ID = `
query ($id: Int) {
  Media(id: $id) {
    id
    format
    countryOfOrigin
    title { romaji english native }
    synonyms
    coverImage { medium }
    siteUrl
  }
}`;

export async function getMediaById(id: number): Promise<AniListMedia | null> {
  try {
    const data = await gqlRequest<{ Media: AniListMedia }>(
      GET_MEDIA_BY_ID,
      { id }
    );
    return data.Media;
  } catch {
    return null;
  }
}

const GET_PROGRESS = `
query ($mediaId: Int, $userId: Int) {
  MediaList(mediaId: $mediaId, userId: $userId) {
    id
    progress
    status
    media {
      id
      title { romaji english native }
      coverImage { medium }
      siteUrl
    }
  }
}`;

export async function getProgress(
  mediaId: number,
  userId: number,
  token: string
): Promise<AniListMediaList | null> {
  try {
    const data = await gqlRequest<{ MediaList: AniListMediaList }>(
      GET_PROGRESS,
      { mediaId, userId },
      token
    );
    return data.MediaList;
  } catch (err) {
    if (err instanceof TokenExpiredError) throw err;
    return null;
  }
}

const SAVE_PROGRESS = `
mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
  SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) {
    id
    progress
    status
  }
}`;

export async function updateProgress(
  mediaId: number,
  chapter: number,
  token: string
): Promise<{ id: number; progress: number; status: string }> {
  const data = await gqlRequest<{
    SaveMediaListEntry: { id: number; progress: number; status: string };
  }>(SAVE_PROGRESS, { mediaId, progress: chapter, status: "CURRENT" }, token);

  return data.SaveMediaListEntry;
}

const GET_VIEWER = `
query {
  Viewer { id name }
}`;

export async function getViewer(
  token: string
): Promise<{ id: number; name: string }> {
  const data = await gqlRequest<{ Viewer: { id: number; name: string } }>(
    GET_VIEWER,
    {},
    token
  );
  return data.Viewer;
}