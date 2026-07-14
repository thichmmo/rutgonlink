'use client'

import { ComposableMap, Geographies, Geography } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// ISO numeric → ISO alpha-2 mapping (world-atlas uses numeric codes)
const NUMERIC_TO_A2: Record<string, string> = {
  '004':'AF','008':'AL','012':'DZ','024':'AO','032':'AR','036':'AU','040':'AT','050':'BD',
  '056':'BE','068':'BO','076':'BR','100':'BG','104':'MM','116':'KH','124':'CA','144':'LK',
  '152':'CL','156':'CN','170':'CO','188':'CR','191':'HR','192':'CU','203':'CZ','204':'BJ',
  '208':'DK','214':'DO','218':'EC','818':'EG','222':'SV','231':'ET','246':'FI','250':'FR',
  '276':'DE','288':'GH','300':'GR','320':'GT','332':'HT','340':'HN','348':'HU','356':'IN',
  '360':'ID','364':'IR','368':'IQ','372':'IE','376':'IL','380':'IT','388':'JM','392':'JP',
  '400':'JO','404':'KE','408':'KP','410':'KR','414':'KW','418':'LA','422':'LB','434':'LY',
  '440':'LT','442':'LU','458':'MY','484':'MX','504':'MA','516':'NA','528':'NL','554':'NZ',
  '558':'NI','566':'NG','578':'NO','586':'PK','591':'PA','598':'PG','600':'PY','604':'PE',
  '608':'PH','616':'PL','620':'PT','642':'RO','643':'RU','682':'SA','686':'SN','703':'SK',
  '706':'SO','710':'ZA','724':'ES','752':'SE','756':'CH','764':'TH','788':'TN','792':'TR',
  '800':'UG','804':'UA','784':'AE','826':'GB','840':'US','858':'UY','862':'VE','704':'VN',
  '887':'YE','894':'ZM','716':'ZW','344':'HK','158':'TW','702':'SG',
}

interface Props {
  data: { country: string; count: number }[]
}

export default function WorldMap({ data }: Props) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const countryMap = new Map(data.map(d => [d.country, d.count]))

  const getColor = (isoNumeric: string) => {
    const alpha2 = NUMERIC_TO_A2[isoNumeric]
    if (!alpha2) return '#e5e7eb'
    const count = countryMap.get(alpha2) || 0
    if (count === 0) return '#e5e7eb'
    const intensity = count / maxCount
    // Blue gradient: light → dark
    const lightness = Math.round(90 - intensity * 55)
    return `hsl(221, 83%, ${lightness}%)`
  }

  const getTooltip = (isoNumeric: string) => {
    const alpha2 = NUMERIC_TO_A2[isoNumeric]
    if (!alpha2) return null
    const count = countryMap.get(alpha2)
    if (!count) return null
    return `${alpha2}: ${count.toLocaleString()} clicks`
  }

  return (
    <div className="w-full">
      <ComposableMap
        projectionConfig={{ scale: 140 }}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const id = String(geo.id).padStart(3, '0')
              const tooltip = getTooltip(id)
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getColor(id)}
                  stroke="#fff"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: '#60a5fa', cursor: tooltip ? 'pointer' : 'default' },
                    pressed: { outline: 'none' },
                  }}
                  title={tooltip || undefined}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Legend */}
      <div className="flex items-center gap-2 justify-end mt-1 px-2">
        <span className="text-xs text-gray-400">Ít</span>
        <div className="flex gap-0.5">
          {[10, 25, 45, 60, 78].map((l) => (
            <div key={l} className="w-5 h-3 rounded-sm" style={{ background: `hsl(221,83%,${l}%)` }} />
          ))}
        </div>
        <span className="text-xs text-gray-400">Nhiều</span>
      </div>
    </div>
  )
}
