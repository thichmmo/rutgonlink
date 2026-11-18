type DomainOption = { id: string | null; domain: string; kind: 'primary' | 'shared' | 'custom' }
type PopupOption = { id: string; isActive?: boolean }

export function defaultPostDomainKey(domains: DomainOption[], preferredDomain?: string | null) {
  // Prioritize the Admin-configured system default domain first, then Top-1M shared fallbacks.
  const candidates = [
    ...(preferredDomain ? [preferredDomain.trim().toLowerCase()] : []),
    'ca33newss.xyz',
    '6739dd4f.nip.io',
    'honghotngay228.site',
  ]
  const matched = candidates
    .map(target => domains.find(domain => domain.domain.toLowerCase() === target && (domain.kind !== 'custom' || Boolean(domain.id))))
    .find(Boolean)
  if (!matched) return 'primary'
  if (matched.kind === 'shared') return `shared:${matched.domain}`
  if (matched.kind === 'custom') return matched.id!
  return 'primary'
}

export function telegramCreateDefaults(domains: DomainOption[], popups: PopupOption[], preferredDomain?: string | null) {
  return {
    domainKey: defaultPostDomainKey(domains, preferredDomain),
    isPublished: true,
    popupIds: refreshCreatePopupSelection([], popups, true),
  }
}

export function refreshCreatePopupSelection(selectedIds: string[], popups: PopupOption[], automatic: boolean) {
  // Options are newest-first; retain a valid draft choice rather than selecting a newer arrival.
  const valid = popups.filter(popup => popup.isActive !== false)
  const selected = selectedIds.filter(id => valid.some(popup => popup.id === id))
  if (selected.length || !automatic) return selected
  return valid[0] ? [valid[0].id] : []
}
