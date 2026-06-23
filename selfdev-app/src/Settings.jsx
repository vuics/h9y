import React, { useState, useEffect } from 'react'
import { isEmpty } from 'lodash'
import axios from 'axios'
import {
  Form,
  Container,
  Segment,
  Loader,
  Message,
  Button,
  Icon,
  Header,
  Divider,
} from 'semantic-ui-react'
// import i18n from "i18next";
import { useTranslation } from 'react-i18next'
import i18n, { LanguageSelector, setI18nLanguage } from './i18n'

import Menubar from './components/Menubar'
import conf from './conf'

export default function Settings () {
  const { t } = useTranslation('Settings')
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ marketingConsent, setMarketingConsent ] = useState(false)

  const getSettings = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/settings`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      console.log('res:', res)
      setI18nLanguage(res?.data?.language || i18n.language)
      setMarketingConsent(res?.data?.marketingConsent)
    } catch (err) {
      console.error('get settings error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting user settings.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getSettings()
  }, [])

  const postSettings = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      console.log('postSettings language:', i18n.language)
      const res = await axios.post(`${conf.api.url}/settings`, {
        language: i18n.language,
        marketingConsent,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('res:', res)
    } catch (err) {
      console.error('post settings error:', err);
      return setResponseError(err?.response?.data?.message || t('Error posting user settings.'))
    } finally {
      setLoading(false)
    }
  }

  return (<>
    <Container fluid>
      <Menubar />
    </Container>

    <Container style={{ marginTop: '1rem' }}>

      <Loader active={loading} inline='centered' />
      { responseError &&
        <Message
          negative
          style={{ textAlign: 'left'}}
          icon='exclamation circle'
          header={t('error')}
          content={responseError}
          onDismiss={() => setResponseError('')}
        />
      }

      <Segment secondary>
        <Header as='h3'>
          {t('settings')}
        </Header>

        <Form>
          <Segment stacked>
            <Form.Field>
              <label>{t('language')}:</label>
              <LanguageSelector />
            </Form.Field>

            <Divider hidden />
            <Form.Field>
              <label>{t('Marketing')}:</label>
              <Form.Checkbox
                label={
                  <label style={{ textAlign: 'left' }}>
                    {t('marketingAgree')}
                  </label>
                }
                checked={marketingConsent}
                onChange={(e, data) => setMarketingConsent(data.checked)}
              >
              </Form.Checkbox>
            </Form.Field>

            <Divider hidden />
            <Button
              icon labelPosition='left'
              onClick={(e) => postSettings(e)}
            >
              <Icon name='save' />
              {t('save')}
            </Button>
          </Segment>
        </Form>
      </Segment>
    </Container>
  </>)
}
