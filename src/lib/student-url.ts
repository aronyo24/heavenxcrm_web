/**
 * Student profile URLs read like `/crm/students/rahim-uddin-42`: the name
 * makes links readable when shared between staff, and the trailing record
 * number keeps them unique (two "Rahim Uddin"s never collide). Only the
 * number is used to look the student up, so a later name change doesn't
 * break old links - the profile page just rewrites the URL to the new name.
 */

export function slugify(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export function studentSlug(id: number | string, name?: string | null): string {
  const base = slugify(name)
  return base ? `${base}-${id}` : String(id)
}

export function studentPath(id: number | string, name?: string | null): string {
  return `/crm/students/${studentSlug(id, name)}`
}

/** The record number at the end of a slug ("rahim-uddin-42" -> "42"); also
 * accepts old bare-number links ("42"). */
export function studentIdFromSlug(slug: string | undefined): string | undefined {
  return slug?.match(/(\d+)$/)?.[1]
}
