import { useEffect } from 'react'
import { useIndexContext } from './IndexContext'

import conf from '../conf'

export default function TawkLoader() {
  const { cookieConsent } = useIndexContext()

  useEffect(() => {
    if (!conf.tawk.enable) { return }

    if (conf.tawk.respectConsent) {
      if (!cookieConsent?.functional) return // only load if functional cookies accepted
    }

    // Set global variables first
    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_LoadStart = new Date()

    // Inject script
    const script = document.createElement('script')
    script.async = true
    script.src=conf.tawk.url
    script.charset = 'UTF-8'
    script.setAttribute('crossorigin', '*')
    document.body.appendChild(script)

    return () => {
      // Optional: remove iframe and cleanup if needed
      const iframe = document.querySelector('iframe[src*="tawk.to"]')
      if (iframe) iframe.remove()
    }
  }, [cookieConsent])

  return null
}
