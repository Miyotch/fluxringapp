/** Move a visible track without deleting temporarily unavailable tracks. */
export function movePlaylistTrack(ids: readonly string[], fromId: string, toId: string): string[] {
  const result = [...ids];
  const from = result.indexOf(fromId), to = result.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return result;
  const [id] = result.splice(from, 1);
  result.splice(to, 0, id);
  return result;
}
