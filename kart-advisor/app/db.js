// Session log on the device (IndexedDB). Falls back to memory if storage is blocked
// (private mode), and says so, so nothing silently disappears.
const DB = 'kart-advisor', STORE = 'sessions', VERSION = 1;
let mem = null;

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('no IndexedDB'));
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => {
      const s = r.result.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('track', 'track');
      s.createIndex('date', 'date');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx(mode, fn) {
  if (mem) return fn(null);
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
      const out = fn(s);
      t.oncomplete = () => resolve(out?.result ?? out);
      t.onerror = () => reject(t.error);
    });
  } catch {
    mem = new Map();
    return fn(null);
  }
}

export const storageIsPersistent = () => !mem;

export async function saveSession(session) {
  const s = { ...session, id: session.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  await tx('readwrite', st => (st ? st.put(s) : mem.set(s.id, s)));
  return s;
}

export async function listSessions(track) {
  const all = await tx('readonly', st => (st ? st.getAll() : [...mem.values()]));
  return (all || []).filter(s => !track || s.track === track).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteSession(id) {
  await tx('readwrite', st => (st ? st.delete(id) : mem.delete(id)));
}

export async function exportJson() {
  return JSON.stringify({ app: 'kart-advisor', exported: new Date().toISOString(), sessions: await listSessions() }, null, 2);
}

export async function importJson(text) {
  const data = JSON.parse(text);
  if (data.app !== 'kart-advisor' || !Array.isArray(data.sessions)) throw new Error('not a kart-advisor export');
  for (const s of data.sessions) await saveSession(s);
  return data.sessions.length;
}
