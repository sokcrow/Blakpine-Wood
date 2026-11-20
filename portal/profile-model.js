// El UID de Firebase es el identificador único. El nombre es sólo una etiqueta.
export function cleanDisplayName(value) {
  const name=String(value ?? '').normalize('NFC').replace(/\s+/gu,' ').trim();
  if (Array.from(name).length < 3 || Array.from(name).length > 32 ||
      /[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(name)) {
    throw Error('DISPLAY_NAME_INVALID');
  }
  return name;
}
export function visibleDisplayName(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
