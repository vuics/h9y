import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Message, Button, Checkbox, Icon
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import { useIndexContext } from './IndexContext'
import conf from '../conf'

const DEFAULT_CONSENT = {
  necessary: true,
  functional: true,
  marketing: true,
}

export default function CookieBanner() {
  const { t, i18n } = useTranslation('CookieBanner')
  const categories = Object.keys(i18n.getResourceBundle(i18n.language, 'CookieBanner')?.categories || []);
  const { cookieConsent, setCookieConsent } = useIndexContext()
  const [showDetails, setShowDetails] = useState(false)
  const [tempConsent, setTempConsent] = useState(DEFAULT_CONSENT)

  useEffect(() => {
    if (showDetails) {
      setTempConsent(cookieConsent || DEFAULT_CONSENT)
    }
  }, [showDetails, cookieConsent])

  if (cookieConsent !== null) {
    return null
  }

  const handleAcceptAll = () => {
    setCookieConsent(DEFAULT_CONSENT)
  }

  const handleToggle = (key) => {
    if (key === 'necessary') return
    setTempConsent(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSavePreferences = () => {
    setCookieConsent({
      ...tempConsent,
      necessary: true,
    })
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      zIndex: 9999,
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'center'
    }}>
      <div style={{
        pointerEvents: 'auto',
        maxWidth: 800,
        width: '100%',
        margin: '1em',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        background: 'white',
        borderRadius: 8
      }}>
        {!showDetails ? (
          <Message warning style={{ margin: 0 }}>
            <Message.Content aria-live="polite">
              <Message.Header>{t('header')}</Message.Header>
              {t('description')}
              {' '}
              <Link to="/cookies">
                {t('learnMore')}
              </Link>
              <div style={{ marginTop: '1em', display: 'flex', gap: '1em', flexWrap: 'wrap' }}>
                <Button
                  icon labelPosition='left'
                  basic
                  onClick={() => setShowDetails(true)}
                >
                  <Icon name='options' />
                  {t('selectPreferences')}
                </Button>
                <Button
                  color={conf.style.color0}
                  icon labelPosition='right'
                  onClick={handleAcceptAll}
                >
                  {t('acceptAll')}
                  <Icon name='checkmark' />
                </Button>
              </div>
            </Message.Content>
          </Message>
        ) : (
          <Message warning style={{ margin: 0 }}>
            <Message.Header>{t('preferences')}</Message.Header>
            <div>
              {categories.map((key) => (
                <Checkbox
                  key={key}
                  toggle
                  checked={tempConsent[key]}
                  onChange={() => handleToggle(key)}
                  disabled={key === 'necessary'}
                  label={`${t(`categories.${key}.label`)}: ${t(`categories.${key}.description`)}`}
                  style={{ display: 'block', marginTop: '0.5em' }}
                />
              ))}
            </div>
            <div style={{ marginTop: '1em', display: 'flex', gap: '1em', flexWrap: 'wrap' }}>
              <Button
                icon labelPosition='left'
                basic
                onClick={() => setShowDetails(false)}
              >
                <Icon name='left arrow' />
                {t('back')}
              </Button>
              <Button
                color={conf.style.color0}
                icon labelPosition='right'
                onClick={handleSavePreferences}
              >
                {t('save')}
                <Icon name='checkmark' />
              </Button>
            </div>
          </Message>
        )}
      </div>
    </div>
  )
}
