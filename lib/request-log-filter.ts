interface RequestLogInput {
    method?: string | null
    path?: string | null
    userAgent?: string | null
    ip?: string | null
}

const ALLOWED_METHODS = new Set(['GET', 'HEAD'])

const LOOPBACK_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1'])

const STATIC_PREFIXES = [
    '/_next/',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap',
]

const BLOCKED_PATH_PREFIXES = [
    '/wp-admin',
    '/wp-content',
    '/wp-includes',
    '/wordpress',
    '/phpmyadmin',
    '/cgi-bin',
    '/.git',
    '/.env',
    '/containers',
]

const BLOCKED_PATH_KEYWORDS = [
    'setup-config.php',
    'wp-login.php',
    'xmlrpc.php',
    'boaform',
    'autodiscover/autodiscover.xml',
    '/vendor/phpunit',
    '/actuator',
    '/server-status',
]

const BLOCKED_UA_KEYWORDS = [
    'bot',
    'crawler',
    'spider',
    'curl/',
    'wget/',
    'python-requests',
    'go-http-client',
    'zgrab',
    'masscan',
    'sqlmap',
    'nikto',
    'nmap',
]

export function isGarbageRequestLog(input: RequestLogInput): boolean {
    const method = (input.method || 'GET').toUpperCase()
    const path = (input.path || '/').split('?')[0]
    const pathLower = path.toLowerCase()
    const uaLower = (input.userAgent || '').toLowerCase()
    const ip = (input.ip || '').trim()

    if (!ALLOWED_METHODS.has(method)) return true
    if (path.length > 500) return true
    if (LOOPBACK_IPS.has(ip)) return true

    if (STATIC_PREFIXES.some((prefix) => pathLower.startsWith(prefix))) return true
    if (BLOCKED_PATH_PREFIXES.some((prefix) => pathLower.startsWith(prefix))) return true
    if (BLOCKED_PATH_KEYWORDS.some((token) => pathLower.includes(token))) return true
    if (BLOCKED_UA_KEYWORDS.some((token) => uaLower.includes(token))) return true

    return false
}
