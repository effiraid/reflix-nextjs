/**
 * Compute related clips for each clip based on tag and folder overlap.
 * Uses inverted indexes for O(N×T×avgClipsPerTag) instead of O(N²×T²).
 *
 * @param {Array} clips - Array of clip objects with tags and folders
 * @param {number} topN - Number of related clips to return per clip
 * @returns {Map<string, string[]>} Map of clipId → related clip IDs
 */
export function buildRelatedInput(clip) {
  return {
    tags: Array.isArray(clip?.tags)
      ? [...clip.tags].map((tag) => String(tag ?? "")).filter(Boolean).sort()
      : [],
    folders: Array.isArray(clip?.folders)
      ? [...clip.folders].map((folder) => String(folder ?? "")).filter(Boolean).sort()
      : [],
    category: String(clip?.category ?? "uncategorized"),
  };
}

export function computeRelatedClips(clips, topN = 5) {
  const tagIndex = new Map();    // tag → Set<clipId>
  const folderIndex = new Map(); // folderId → Set<clipId>

  for (const clip of clips) {
    for (const tag of clip.tags) {
      if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
      tagIndex.get(tag).add(clip.id);
    }
    for (const folder of clip.folders) {
      if (!folderIndex.has(folder)) folderIndex.set(folder, new Set());
      folderIndex.get(folder).add(clip.id);
    }
  }

  const result = new Map();

  for (const clip of clips) {
    // Count tag overlap per candidate via inverted index
    const tagScores = new Map();
    for (const tag of clip.tags) {
      const peers = tagIndex.get(tag);
      if (!peers) continue;
      for (const peerId of peers) {
        if (peerId === clip.id) continue;
        tagScores.set(peerId, (tagScores.get(peerId) || 0) + 1);
      }
    }

    // Collect candidates sharing any folder
    const folderPeers = new Set();
    for (const folder of clip.folders) {
      const peers = folderIndex.get(folder);
      if (!peers) continue;
      for (const peerId of peers) {
        if (peerId !== clip.id) folderPeers.add(peerId);
      }
    }

    // Merge scores: tag overlap + folder bonus (+2 if sharing any folder)
    const allCandidates = new Set([...tagScores.keys(), ...folderPeers]);
    const scored = [];
    for (const id of allCandidates) {
      const score = (tagScores.get(id) || 0) + (folderPeers.has(id) ? 2 : 0);
      scored.push({ id, score });
    }

    scored.sort((a, b) => b.score - a.score);
    result.set(clip.id, scored.slice(0, topN).map((s) => s.id));
  }

  return result;
}
