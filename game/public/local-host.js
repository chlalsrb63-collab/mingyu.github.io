/** Classify a URL hostname as loopback or a private IPv4 address. */
export function localHost(host) {
  if (host === "localhost" || host === "[::1]") return true;
  const parts = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (!parts) return false;
  const first = Number(parts[1]), second = Number(parts[2]);
  return first === 127 || first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

/** Paths served by the local recording route, in URL-encoded form. */
export const LOCAL_BGM_PATH = /^\/__local-bgm\/((?:(?:inside|arbeit)\/)?[a-z0-9][a-z0-9_.-]*\.mp3|17\.%20aircraft\.mp3|18\.dawn%20sea\.mp3)$/i;
