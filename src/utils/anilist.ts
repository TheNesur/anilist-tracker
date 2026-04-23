import type { AniListMedia, AniListMediaList } from "../types";

const ANILIST_API = "https://graphql.anilist.co";

async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string | null
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

  const json = await res.json();

  if (json.errors) {
    throw new Error(json.errors[0]?.message ?? "AniList API error");
  }

  return json.data as T;
}

const SEARCH_MANGA = `
query ($search: String) {
  Page(perPage: 5) {
    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        medium
      }
      siteUrl
    }
  }
}`;

export async function searchManga(
  title: string
): Promise<AniListMedia[]> {
  const data = await gqlRequest<{
    Page: { media: AniListMedia[] };
  }>(SEARCH_MANGA, { search: title });

  return data.Page.media;
}

const GET_PROGRESS = `
query ($mediaId: Int, $userId: Int) {
  MediaList(mediaId: $mediaId, userId: $userId) {
    id
    progress
    status
    media {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        medium
      }
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
    const data = await gqlRequest<{
      MediaList: AniListMediaList;
    }>(GET_PROGRESS, { mediaId, userId }, token);

    return data.MediaList;
  } catch {
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
  }>(SAVE_PROGRESS, {
    mediaId,
    progress: chapter,
    status: "CURRENT",
  }, token);

  return data.SaveMediaListEntry;
}

const GET_VIEWER = `
query {
  Viewer {
    id
    name
  }
}`;

export async function getViewer(
  token: string
): Promise<{ id: number; name: string }> {
  const data = await gqlRequest<{
    Viewer: { id: number; name: string };
  }>(GET_VIEWER, {}, token);

  return data.Viewer;
}
