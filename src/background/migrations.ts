const CURRENT_SCHEMA_VERSION = 1;

async function migrateScopedTitleMappings(): Promise<void> {
  const data = await chrome.storage.local.get({ titleMappings: {}, legacyTitleMappings: {} });
  const existing = data.titleMappings as Record<string, number>;
  const legacy = { ...(data.legacyTitleMappings as Record<string, number>) };

  const scoped: Record<string, number> = {};
  let moved = 0;

  for (const [key, mediaId] of Object.entries(existing)) {
    if (key.includes("::")) {
      scoped[key] = mediaId;
      continue;
    }
    legacy[key] = mediaId;
    moved++;
  }

  if (moved === 0) return;

  await chrome.storage.local.set({ titleMappings: scoped, legacyTitleMappings: legacy });
}

async function run(): Promise<void> {
  const { schemaVersion } = await chrome.storage.local.get({ schemaVersion: 0 });
  if (schemaVersion >= CURRENT_SCHEMA_VERSION) return;

  if (schemaVersion < 1) {
    await migrateScopedTitleMappings();
  }

  await chrome.storage.local.set({ schemaVersion: CURRENT_SCHEMA_VERSION });
}

export const migrationsReady: Promise<void> = run().catch((err) => {
  console.error("[AniList Tracker] Migration failed:", err);
});
