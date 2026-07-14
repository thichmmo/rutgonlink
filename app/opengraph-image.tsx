import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const alt = 'Rút gọn link chuyên nghiệp - rutgonlink.site'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  const logoBase64 = readFileSync(join(process.cwd(), 'public/vmetalogo.png')).toString('base64')
  const logoSrc = `data:image/png;base64,${logoBase64}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0f1e 0%, #111827 60%, #1a0a0a 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow top-right */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-80px',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.18) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Glow bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            left: '-60px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            zIndex: 1,
            padding: '0 80px',
          }}
        >
            {/* Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
            width={140}
            height={140}
            style={{ objectFit: 'contain', borderRadius: '24px' }}
          />

          {/* Title */}
          <div
            style={{
              color: 'white',
              fontSize: '60px',
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: 1.15,
              letterSpacing: '-1px',
            }}
          >
            Rút gọn link chuyên nghiệp
          </div>

          {/* Domain badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(239,68,68,0.15)',
              border: '1.5px solid rgba(239,68,68,0.4)',
              borderRadius: '999px',
              padding: '8px 28px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
                display: 'flex',
              }}
            />
            <span style={{ color: '#ef4444', fontSize: '28px', fontWeight: 700 }}>
          rutgonlink.site
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              color: '#94a3b8',
              fontSize: '24px',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Miễn phí · Thống kê click · Chuyển hướng thông minh
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
