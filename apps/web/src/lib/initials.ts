// Thai vowels written before their consonant (เ แ โ ใ ไ) — skip them so "เอก" shows "อ", not "เ".
const LEADING_VOWELS = /^[\u0E40-\u0E44]+/u;
const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

/** One letter for an avatar circle: first grapheme, uppercased ("somchai" → "S", "เอก" → "อ"). */
export function initialOf(name: string): string {
  const trimmed = name.trim().replace(LEADING_VOWELS, "");
  const first = graphemes.segment(trimmed)[Symbol.iterator]().next().value?.segment ?? "?";
  return first.toLocaleUpperCase("en");
}
