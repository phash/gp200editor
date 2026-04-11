/**
 * Serialize a JSON-LD object to a string safe to embed inside a
 * `<script type="application/ld+json">` block via React's raw-HTML prop.
 *
 * Three escape passes:
 *   1. `<` → `\u003c` — stops a user-content-derived `</script>` from
 *      ending the script block early.
 *   2. `\u2028` → `\u2028` escape sequence, `\u2029` → `\u2029` —
 *      line separator / paragraph separator are valid JSON but illegal
 *      in ECMAScript string literals prior to ES2019. Older browsers or
 *      JS parsers throw `SyntaxError` on them. JSON.stringify emits them
 *      literally, so we have to re-escape.
 *
 * Always use this helper when emitting JSON-LD. Inline `.replace(/</g, ...)`
 * calls miss the LS/PS case.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
