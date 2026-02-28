import process from "process";

const DEFAULT_TTL_MS = Number(process.env.CACHE_TTL_MS || 30000);

const cacheStore = new Map();
const tagIndex = new Map();

export const makeCacheKey = (parts) => JSON.stringify(parts);

export const getCache = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value;
};

export const setCache = (key, value, tags = [], ttlMs = DEFAULT_TTL_MS) => {
  const expiresAt = Date.now() + ttlMs;
  cacheStore.set(key, { value, expiresAt });

  for (const tag of tags) {
    if (!tagIndex.has(tag)) {
      tagIndex.set(tag, new Set());
    }
    tagIndex.get(tag).add(key);
  }
};

export const invalidateCacheByTags = (tags = []) => {
  for (const tag of tags) {
    const keys = tagIndex.get(tag);
    if (!keys) continue;

    for (const key of keys) {
      cacheStore.delete(key);
    }

    tagIndex.delete(tag);
  }
};

export const buildResourceTags = (resourceName, id = null) => {
  const tags = [`resource:${resourceName}`];
  if (id) tags.push(`resource:${resourceName}:${id}`);
  return tags;
};
