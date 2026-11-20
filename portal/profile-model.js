// El UID de Firebase es el identificador único. El nombre es sólo una etiqueta.
export function cleanDisplayName(value) {
  const raw=String(value ?? '').normalize('NFC');
  if (/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(raw)) {
    throw Error('DISPLAY_NAME_INVALID');
  }
  const name=raw.replace(/\s+/gu,' ').trim();
  if (Array.from(name).length < 3 || Array.from(name).length > 32) {
    throw Error('DISPLAY_NAME_INVALID');
  }
  return name;
}
export function visibleDisplayName(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
