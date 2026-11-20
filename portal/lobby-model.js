// Identificador de versión de sala, no una contraseña ni un token de acceso.
export function makeLobbyId(random=globalThis.crypto) {
  if(typeof random?.getRandomValues!=='function')throw Error('LOBBY_CRYPTO_REQUIRED');
  const bytes=new Uint8Array(16);
  random.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function isWaitingLobby(data) {
  return data?.status==='waiting' &&
    typeof data.roomId==='string' && /^[A-F0-9]{32}$/.test(data.roomId);
}
export function isJoinedParticipant(value,roomId) {
  return typeof roomId==='string' && value?.roomId===roomId && value?.state==='joined';
}
