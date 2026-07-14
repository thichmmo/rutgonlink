declare module 'react-simple-maps' {
  import { ComponentProps, ReactNode } from 'react'

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: Record<string, unknown>
    style?: React.CSSProperties
    width?: number
    height?: number
    [key: string]: unknown
  }

  interface GeographiesProps {
    geography: string | Record<string, unknown>
    children: (props: { geographies: Geography[] }) => ReactNode
    [key: string]: unknown
  }

  interface Geography {
    rsmKey: string
    id: string | number
    properties: Record<string, unknown>
    [key: string]: unknown
  }

  interface GeographyProps {
    geography: Geography
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: React.CSSProperties
      hover?: React.CSSProperties
      pressed?: React.CSSProperties
    }
    title?: string
    [key: string]: unknown
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
}
