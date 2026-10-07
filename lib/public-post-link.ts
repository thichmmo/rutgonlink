const numericPostSlugPattern = /^p7-([1-9]\d{4})$/

export function isNumericPostSlug(slug: string) {
  return numericPostSlugPattern.test(slug)
}

export function numericPostSlug(code: string) {
  return /^[1-9]\d{4}$/.test(code) ? `p7-${code}` : null
}

export function getPublicPostPath(slug: string) {
  const match = numericPostSlugPattern.exec(slug)
  // The existing unique slug stores the namespace, without changing old slug routes.
  return match ? `/p7/${match[1]}` : `/${encodeURIComponent(slug)}`
}
