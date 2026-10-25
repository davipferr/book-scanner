/** Book cloths for library covers; each has `--cloth-<name>` in style.css. */
export const CLOTHS = ['green', 'oxblood', 'navy', 'aubergine', 'umber', 'teal'] as const;

export type ClothName = (typeof CLOTHS)[number];

/** The cloth a book is bound in, fixed by its id so it never changes between visits. */
export function bookCloth(id: number): ClothName {
  const n = Math.abs(Math.trunc(id)) % CLOTHS.length;
  return CLOTHS[Number.isFinite(n) ? n : 0];
}
