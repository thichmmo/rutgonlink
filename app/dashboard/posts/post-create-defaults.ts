type DomainOption = { id: string | null; domain: string; kind: 'primary' | 'shared' | 'custom' }
type PopupOption = { id: string; isActive?: boolean }

export function telegramCreateDefaults(domains: DomainOption[], popups: PopupOption[]) {
  // Prefer ca33newss.xyz (Tranco Top-1M) for Facebook l.php comments; retain nip.io and legacy fallbacks.
  const preferred = ['ca33newss.xyz', '6739dd4f.nip.io', 'honghotngay228.site']
    .map(target => domains.find(domain => domain.domain.toLowerCase() === target && (domain.kind !== 'custom' || Boolean(domain.id))))
    .find(Boolean)
  const domainKey = preferred?.kind === 'shared' ? `shared:${preferred.domain}`
    : preferred?.kind === 'custom' ? preferred.id! : 'primary'
  return { domainKey, isPublished: true, popupIds: refreshCreatePopupSelection([], popups, true) }
}

export function refreshCreatePopupSelection(selectedIds: string[], popups: PopupOption[], automatic: boolean) {
  // Options are newest-first; retain a valid draft choice rather than selecting a newer arrival.
  const valid = popups.filter(popup => popup.isActive !== false)
  const selected = selectedIds.filter(id => valid.some(popup => popup.id === id))
  if (selected.length || !automatic) return selected
  return valid[0] ? [valid[0].id] : []
}
