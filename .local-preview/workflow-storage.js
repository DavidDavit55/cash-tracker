// Local demo only. Recoverable deletion preserves complete cases, not just names.
export function removeDemoClients(state, ids, at = new Date().toISOString()) {
  const selected = new Set(ids);
  const removed = state.clients.filter(client => selected.has(client.id));
  if (!removed.length) throw Error('לא נבחרו תיקים למחיקה.');
  return {...state,
    selected: selected.has(state.selected) ? null : state.selected,
    clients: state.clients.filter(client => !selected.has(client.id)),
    deletedClients: [...(state.deletedClients || []), ...removed.map(client => ({client, deletedAt: at}))],
  };
}
export function restoreDemoClients(state) {
  const existing = new Set(state.clients.map(client => client.id));
  return {...state, clients: [...state.clients, ...(state.deletedClients || []).map(item => item.client).filter(client => !existing.has(client.id))], deletedClients: []};
}
