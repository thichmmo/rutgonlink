'use client'

import { useEffect } from 'react'

export default function NotFound() {
  useEffect(() => {
    // Set title to hostname
    document.title = window.location.hostname

    // Remove all meta tags from head
    const metaTags = document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')
    metaTags.forEach(tag => tag.remove())
  }, [])

  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h1 style={{
            fontSize: '120px',
            fontWeight: 'bold',
            margin: 0,
            lineHeight: 1,
          }}>404</h1>
        </div>
      </body>
    </html>
  )
}
