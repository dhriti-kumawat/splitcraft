const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * 32-bit FNV-1a over the UTF-16 code units of `input`, followed by the
 * MurmurHash3 finaliser. Plain FNV-1a has weak low bits on short, similar
 * keys (e.g. "v1exp", "v2exp"); the finaliser spreads them so `% 10000`
 * stays uniform.
 */
export function hash32(input: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
