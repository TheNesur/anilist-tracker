import { errMsg } from "./dom";
import { AniListUnreachableError, TokenExpiredError, type AniListMedia, type AniListMediaList } from "../types";
import { sleep } from "./sleep";

const ANILIST_API = "https://graphql.anilist.co";
const SEARCH_PER_PAGE = 10;
const MAX_RETRIES_429 = 3;
const DEFAULT_RETRY_AFTER_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

const MANGA_FORMATS = ["MANGA", "ONE_SHOT"];
const ANIME_FORMATS = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA"];

interface GqlErrorItem {
  message: string;
  path?: (string | number)[];
}

interface RawGqlResult<T> {
  data: T | null;
  errors: GqlErrorItem[] | null;
}

async function rawGqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string | null,
  retryCount = 0
): Promise<RawGqlResult<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ANILIST_API, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AniListUnreachableError("AniList request timed out");
    }
    throw new AniListUnreachableError(errMsg(err));
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401) {
    throw new TokenExpiredError();
  }

  if (res.status === 429) {
    if (retryCount >= MAX_RETRIES_429) {
      throw new AniListUnreachableError("AniList rate limit: max retries exceeded");
    }
    const retryAfter = Number(res.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : DEFAULT_RETRY_AFTER_MS;
    await sleep(waitMs);
    return rawGqlRequest<T>(query, variables, token, retryCount + 1);
  }

  if (res.status >= 500) {
    throw new AniListUnreachableError(`AniList server error: ${res.status}`);
  }

  let json: { data?: T; errors?: GqlErrorItem[] };
  try {
    json = await res.json();
  } catch {
    throw new AniListUnreachableError("AniList returned an invalid response");
  }

  return { data: json.data ?? null, errors: json.errors ?? null };
}

async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string | null,
  retryCount = 0
): Promise<T> {
  const { data, errors } = await rawGqlRequest<T>(query, variables, token, retryCount);

  if (errors) {
    throw new Error(errors[0]?.message ?? "AniList API error");
  }

  return data as T;
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

const GET_PROGRESS_COLLECTION = `
query ($userId: Int, $type: MediaType) {
  MediaListCollection(userId: $userId, type: $type) {
    lists {
      entries {
        mediaId
        progress
      }
    }
  }
}`;

export async function getProgressCollection(
  userId: number,
  type: "MANGA" | "ANIME",
  token: string
): Promise<Record<number, number>> {
  const data = await gqlRequest<{
    MediaListCollection: { lists: { entries: { mediaId: number; progress: number }[] }[] };
  }>(GET_PROGRESS_COLLECTION, { userId, type }, token);

  const result: Record<number, number> = {};
  for (const list of data.MediaListCollection.lists) {
    for (const entry of list.entries) {
      result[entry.mediaId] = entry.progress;
    }
  }
  return result;
}

export interface BatchUpdateItem {
  mediaId: number;
  progress: number;
}

export interface BatchUpdateResult {
  mediaId: number;
  success: boolean;
  progress?: number;
  error?: string;
}

export async function saveProgressBatch(
  items: BatchUpdateItem[],
  token: string
): Promise<BatchUpdateResult[]> {
  if (items.length === 0) return [];

  const variableDefs: string[] = [];
  const fields: string[] = [];
  const variables: Record<string, unknown> = {};

  items.forEach((item, i) => {
    variableDefs.push(`$mediaId${i}: Int, $progress${i}: Int`);
    fields.push(`
      u${i}: SaveMediaListEntry(mediaId: $mediaId${i}, progress: $progress${i}, status: CURRENT) {
        id
        progress
        status
      }`);
    variables[`mediaId${i}`] = item.mediaId;
    variables[`progress${i}`] = item.progress;
  });

  const query = `
    mutation (${variableDefs.join(", ")}) {
      ${fields.join("\n")}
    }`;

  const { data, errors } = await rawGqlRequest<Record<string, { id: number; progress: number; status: string } | null>>(
    query,
    variables,
    token
  );

  const errorsByAlias = new Map<string, string>();
  if (errors) {
    for (const err of errors) {
      const alias = err.path?.[0];
      if (typeof alias === "string") {
        errorsByAlias.set(alias, err.message);
      }
    }
  }

  return items.map((item, i) => {
    const alias = `u${i}`;
    const result = data?.[alias];
    if (result) {
      return { mediaId: item.mediaId, success: true, progress: result.progress };
    }
    return {
      mediaId: item.mediaId,
      success: false,
      error: errorsByAlias.get(alias) ?? "Unknown error",
    };
  });
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
