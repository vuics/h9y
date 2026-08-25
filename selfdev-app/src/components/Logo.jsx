import React from 'react'

import LogoChipSvg from '../logo.svg'
import LogoChipMarkSvg from '../logo-chip-mark.svg'
import conf from '../conf'

const sizes = {
  nano: '15px',
  milli: '23px',
  mini: '35px',
  tiny: '50px',
  small: '80px',
  standard: '100px',
  medium: '100px',
  large: '150px',
  big: '200px',
  huge: '300px',
  massive: '450px'
}

// Below this the eight tip glyphs stop resolving and turn to mud, so the
// glyphless cut is used instead. See selfdev-assets/logo/logo-v3/README.md.
const GLYPH_THRESHOLD = 128

export default function Logo ({ children, style, size = 'medium', gray = conf.style.grayLogo } = {}) {
  const px = parseInt(sizes[size], 10)
  return (
    <img
      src={px >= GLYPH_THRESHOLD ? LogoChipSvg : LogoChipMarkSvg}
      alt="Our logo"
      style={{
        filter: gray ? 'grayscale(100%)' : null,
        width: sizes[size],
        height: sizes[size],
        objectFit: 'contain',
        ...style,
      }}
    >
      {children}
    </img>
  )
}
