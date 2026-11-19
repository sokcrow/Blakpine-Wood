// Datos compartidos y validaciones puras. La autorización real vive en firestore.rules.
export const RULESETS = Object.freeze(['legacy', 'dnd']);
export const invitePattern = /^[A-F0-9]{48}$/;
export function makeInvitationCode(random = globalThis.crypto) {
  if (!random || typeof random.getRandomValues !== 'function') throw new Error('INVITE_CRYPTO_REQUIRED');
  const bytes = new Uint8Array(24);
  random.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function cleanInvitationCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (!invitePattern.test(code)) throw new Error('INVITATION_INVALID');
  return code;
}
export function campaignName(value) {
  const name = String(value ?? '').trim();
  if (!name || name.length > 80) throw new Error('CAMPAIGN_NAME_INVALID');
  return name;
}
export function availableRuleset(value) {
  if (!RULESETS.includes(value)) throw new Error('RULESET_NOT_AVAILABLE');
  return value;
}
