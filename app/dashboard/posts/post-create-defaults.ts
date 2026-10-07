type DomainOption = { id: string | null; domain: string; kind: 'primary' | 'shared' | 'custom' }
type PopupOption = { id: string; isActive?: boolean }

export function telegramCreateDefaults(domains: DomainOption[], popups: PopupOption[]) {
  const preferred = domains.find(domain => domain.domain.toLowerCase() === 'honghotngay228.site'
    && (domain.kind !== 'custom' || Boolean(domain.id)))
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
