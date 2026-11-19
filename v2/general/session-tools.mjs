import assert from 'node:assert/strict';

export async function candidates(api, directory, input, now = Date.now()) {
  const rows = [], seen = new Set();
  let cursor;
  for (let page = 0; page < 100; page++) {
    const result = await api.list(cursor ? { cursor } : { ...(input.allProjects ? {} : { directory }), limit: 100 });
    assert(Array.isArray(result.data) && result.cursor, 'Unrecognized native session page; no deletion');
    for (const session of result.data) {
      assert(session.id && session.location?.directory && Number.isFinite(session.time?.updated), 'Unrecognized session metadata; no deletion');
      if (seen.has(session.id)) continue;
      seen.add(session.id);
      if (!input.allProjects && session.location.directory !== directory) continue;
      if (!input.includeRoot && !session.parentID) continue;
      if (now - session.time.updated < (input.olderThanMinutes ?? 0) * 60000) continue;
      rows.push(structuredClone(session));
    }
    if (!result.cursor.next) return rows;
    assert(result.cursor.next !== cursor, 'Session cursor did not advance');
    cursor = result.cursor.next;
  }
  throw new Error('Session listing limit reached; no deletion');
}

export async function cleanup(api, directory, input, activeSessionID, authorize, signal) {
  assert(Array.isArray(input.sessionIDs) && input.sessionIDs.length > 0, 'Explicit session IDs required');
  const protectedIDs = new Set();
  let current = activeSessionID;
  while (current) {
    assert(!protectedIDs.has(current) && protectedIDs.size < 100, 'Invalid parent chain; no deletion');
    protectedIDs.add(current);
    current = (await api.get({ sessionID: current })).parentID;
  }
  const snapshot = await candidates(api, directory, { allProjects: true, includeRoot: true });
  const eligible = session => (input.allProjects || session.location.directory === directory)
    && (input.includeRoot || Boolean(session.parentID))
    && Date.now() - session.time.updated >= (input.olderThanMinutes ?? 0) * 60000;
  const allowed = new Map(snapshot.filter(eligible).map(session => [session.id, session]));
  const ids = [...new Set(input.sessionIDs)];
  for (const id of ids) assert(allowed.has(id) && !protectedIDs.has(id), 'Session outside selected scope or current ancestry; no deletion');
  const expanded = new Set(ids);
  for (let previousSize = -1; previousSize !== expanded.size;) {
    previousSize = expanded.size;
    for (const row of snapshot) if (expanded.has(row.parentID)) expanded.add(row.id);
  }
  assert(expanded.size <= 100, 'Recursive deletion too broad; narrow the selection');
  for (const id of expanded) assert(allowed.has(id) && !protectedIDs.has(id), 'Recursive descendant outside selected scope/current ancestry; no deletion');
  const roots = ids.filter(id => !expanded.has(allowed.get(id).parentID));
  assert(roots.length > 0, 'Invalid recursive session graph; no deletion');
  // Native remove recursively deletes descendants and can interrupt execution.
  // The prompt explicitly describes that effect; do not claim idle-only cleanup.
  signal?.throwIfAborted();
  await authorize([...expanded]);
  const latest = await candidates(api, directory, { allProjects: true, includeRoot: true });
  for (const row of latest) if (expanded.has(row.parentID)) assert(expanded.has(row.id), 'New descendant since selection; no deletion');
  for (const id of expanded) {
    const live = latest.find(row => row.id === id), prior = allowed.get(id);
    assert(live && live.location.directory === prior.location.directory && live.parentID === prior.parentID && live.time.updated === prior.time.updated, 'Session changed since selection; no deletion');
  }
  const deleted = [];
  for (const id of roots) {
    try {
      signal?.throwIfAborted();
      const live = await api.get({ sessionID: id });
      const prior = allowed.get(id);
      assert(live.location.directory === prior.location.directory && live.parentID === prior.parentID && live.time.updated === prior.time.updated, 'Session changed since selection; stop cleanup');
      await api.remove({ sessionID: id }, { signal }); deleted.push(id);
    }
    catch { return { deleted, failed: [id], recursive: true, complete: false, note: 'Deletion stopped; no automatic retry or rollback' }; }
  }
  return { deleted, selectedIncludingDescendants: [...expanded], recursive: true, complete: true, mayInterruptSelectedSessions: true };
}
