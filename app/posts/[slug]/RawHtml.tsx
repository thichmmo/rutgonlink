'use client'

import { useEffect, useRef } from 'react'

export default function RawHtml({ html }: { html: string }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = container.current
    if (!root) return
    root.querySelectorAll('script').forEach(original => {
      const executable = document.createElement('script')
      for (const attribute of original.attributes) executable.setAttribute(attribute.name, attribute.value)
      executable.textContent = original.textContent
      original.replaceWith(executable)
    })
  }, [html])

  return <div ref={container} dangerouslySetInnerHTML={{ __html: html }} />
}
