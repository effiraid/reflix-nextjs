/**
 * Compute related clips for each clip based on tag overlap.
 * @param {Array} clips - Array of clip objects with tags and folders
 * @param {number} topN - Number of related clips to return per clip
 * @returns {Map<string, string[]>} Map of clipId → related clip IDs
 */
export function computeRelatedClips(clips, topN = 5) {
  const result = new Map();

  for (const clip of clips) {
    const scores = [];

    for (const other of clips) {
      if (other.id === clip.id) continue;

      // Tag overlap count
      const tagOverlap = clip.tags.filter((t) => other.tags.includes(t)).length;

      // Same folder bonus
      const sameFolderBonus = clip.folders.some((f) => other.folders.includes(f)) ? 2 : 0;

      const score = tagOverlap + sameFolderBonus;
      if (score > 0) {
        scores.push({ id: other.id, score });
      }
    }

    // Sort by score descending, take top N
    scores.sort((a, b) => b.score - a.score);
    result.set(clip.id, scores.slice(0, topN).map((s) => s.id));
  }

  return result;
}
