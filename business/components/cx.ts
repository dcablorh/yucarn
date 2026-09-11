/**
 * Joins class names, dropping the falsy ones a conditional produces.
 *
 * Deliberately not tailwind-merge: no new dependencies, and none of the
 * primitives here need last-wins conflict resolution. A caller's
 * className is appended after the base in the string, but that buys
 * nothing: Tailwind resolves two classes that set the same CSS property
 * on the same element by where each rule lands in the *compiled
 * stylesheet* (utilities are emitted alphabetically), not by the order
 * the classes appear in `class=`. A later class in the string can
 * still lose. Overriding a colour (or any property) a primitive already
 * sets on an element requires a different element — an inner span for
 * text colour, a wrapper for border/background — or a different
 * property, never just a class appended after the base.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
