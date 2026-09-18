/**
 * Escapes a value for interpolation into a double-quoted field inside prompt
 * text (e.g. `` `source="${escapeForPromptQuote(name)}"` ``). Untrusted strings
 * — a raw uploaded filename, an AI-extracted concept name from a document —
 * can contain a literal `"` or newline that breaks out of the intended quoted
 * span, letting the rest of the value read as new prompt structure rather than
 * data. This is a distinct risk from the model *obeying* an injected
 * instruction (handled separately via <tag>-wrapping + systemInstruction) —
 * it's a formatting bug that happens regardless of whether the model would
 * have obeyed anything.
 */
export function escapeForPromptQuote(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ");
}
