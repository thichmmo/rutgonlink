/**
 * Shared/public domains available for all users when creating short links.
 * Update this list to add or remove shared domains.
 */
export const SHARED_DOMAINS = [
  // Non-PSL Tranco Top-1M hostnames routed directly to cPanel (103.57.221.79 = 0x6739dd4f)
  // so unsigned Facebook link-shim comments (facebook.com/l.php?u=...) pass Sentry 1404006.
  '6739dd4f.nip.io',
  'tin24h-6739dd4f.nip.io',
  '103-57-221-79.sslip.io',
  'phimngay.site',
  'honghotngay228.site',
  'phimhaybaz.site',
  'baonewtin.site',
]
