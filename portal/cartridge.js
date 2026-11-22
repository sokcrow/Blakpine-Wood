// Portable data only. Authorization must come from a fresh Firebase campaign read.
export const FORMAT_VERSION = 1;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 256;
const date = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const fail = code => { throw new Error(code); };
export const copy = v => JSON.parse(JSON.stringify(v));
export function authorize(context) {
  if (!context || !id(context.uid) || !id(context.campaignId) ||
      context.ownerUid !== context.uid || !['legacy','dnd'].includes(context.rulesetId) ||
      context.status !== 'active') fail('CARTRIDGE_ACCESS');
  return context;
}
export function newId() {
  if (!globalThis.crypto?.randomUUID) fail('CARTRIDGE_CRYPTO');
  return crypto.randomUUID();
}
export function mapName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160) fail('MAP_NAME');
  return value.trim();
}
export function validateCartridge(doc, context, validateMap) {
  authorize(context);
  if (!object(doc)) fail('CARTRIDGE_STRUCTURE');
  if (doc.formatVersion !== FORMAT_VERSION) fail('CARTRIDGE_VERSION');
  if (!id(doc.cartridgeId) || !Number.isSafeInteger(doc.revision) || doc.revision < 1 ||
      !date(doc.createdAt) || !date(doc.updatedAt) || Date.parse(doc.updatedAt) < Date.parse(doc.createdAt)) fail('CARTRIDGE_STRUCTURE');
  if (doc.campaignId !== context.campaignId || doc.ownerUid !== context.uid ||
      doc.rulesetId !== context.rulesetId) fail('CARTRIDGE_IDENTITY');
  // v1 reserves these sections. No fabricated world snapshots or transitions.
  if (!Array.isArray(doc.connections) || doc.connections.length || !object(doc.worldState) ||
      doc.worldState.version !== 1 || doc.worldState.data !== null || !Array.isArray(doc.maps)) fail('CARTRIDGE_STRUCTURE');
  const allowed = ['formatVersion','cartridgeId','campaignId','ownerUid','rulesetId','revision','createdAt','updatedAt','maps','connections','worldState'];
  if (Object.keys(doc).some(k => !allowed.includes(k)) ||
      Object.keys(doc.worldState).some(k => !['version','data'].includes(k))) fail('CARTRIDGE_STRUCTURE');
  if (typeof validateMap !== 'function') fail('MAP_VALIDATOR_REQUIRED');
  const seen = new Set();
  for (const map of doc.maps) {
    if (!object(map) || !id(map.mapId) || seen.has(map.mapId) || !date(map.createdAt) ||
        !date(map.updatedAt) || Date.parse(map.updatedAt) < Date.parse(map.createdAt) ||
        Object.keys(map).some(k => !['mapId','name','project','createdAt','updatedAt'].includes(k))) fail('CARTRIDGE_STRUCTURE');
    mapName(map.name); seen.add(map.mapId);
    // Validate a copy: editor migrations/normalizers never replace the stored JSON.
    validateMap(copy(map.project));
  }
  return doc;
}
export function createCartridge(context) {
  authorize(context);
  const now = new Date().toISOString();
  return {formatVersion:FORMAT_VERSION,cartridgeId:newId(),campaignId:context.campaignId,
    ownerUid:context.uid,rulesetId:context.rulesetId,revision:1,createdAt:now,updatedAt:now,
    maps:[],connections:[],worldState:{version:1,data:null}};
}
export function importCartridge(text, context, validateMap) {
  let doc;
  try { doc = JSON.parse(text); } catch { fail('CARTRIDGE_JSON'); }
  validateCartridge(doc, context, validateMap);
  return doc;
}
export function exportCartridge(doc, context, validateMap) {
  validateCartridge(doc, context, validateMap);
  return JSON.stringify(doc);
}
export function changeMap(doc, context, validateMap, {mapId=null,name,project,expectedRevision}) {
  validateCartridge(doc, context, validateMap);
  if (expectedRevision !== doc.revision) fail('CARTRIDGE_CONFLICT');
  const next = copy(doc), now = new Date().toISOString();
  const previous = mapId === null ? null : next.maps.find(m => m.mapId === mapId);
  if (mapId !== null && !previous) fail('MAP_MISSING');
  const entry = previous || {mapId:newId(),createdAt:now};
  entry.name = mapName(name);
  if (project !== undefined) { validateMap(copy(project)); entry.project = copy(project); }
  if (!previous && project === undefined) fail('MAP_MISSING');
  entry.updatedAt = now;
  if (!previous) next.maps.push(entry);
  next.revision++; next.updatedAt = now;
  validateCartridge(next, context, validateMap);
  return {cartridge:next,mapId:entry.mapId};
}
export function cartridgeFilename(name) {
  return (String(name).normalize('NFC').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,100) || 'Partida') + '.lumen.json';
}
