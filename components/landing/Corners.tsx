import React from 'react'

export default function Corners({ color = '#00D4AA', size = 10 }: { color?: string; size?: number }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    pointerEvents: 'none',
  }
  const b = `1.5px solid ${color}`

  return (
    <>
      <span style={{ ...base, top: -1, left: -1, borderTop: b, borderLeft: b }} />
      <span style={{ ...base, top: -1, right: -1, borderTop: b, borderRight: b }} />
      <span style={{ ...base, bottom: -1, left: -1, borderBottom: b, borderLeft: b }} />
      <span style={{ ...base, bottom: -1, right: -1, borderBottom: b, borderRight: b }} />
    </>
  )
}
