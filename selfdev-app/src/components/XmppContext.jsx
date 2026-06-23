import React, {
  useEffect, useState, useRef, createContext, useContext
} from 'react'
import axios from 'axios'
import lodash from 'lodash'
const { isEmpty } = lodash
import { Loader, Message, } from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import { XmppClient } from '../maptor'
import conf from '../conf'

export const XmppContext = createContext({});
export const useXmppContext = () => useContext(XmppContext);

export function XmppProvider({ children }) {
  const { t } = useTranslation('XmppContext')
  const [ credentials, setCredentials ] = useState(null)
  const xmppClientRef = useRef(null);

  const [ loading, setLoading ] = useState(true)
  const [ responseError, setResponseError ] = useState('')

  useEffect(() =>{
    async function fetchCredentials () {
      try {
        setLoading(true)
        const response = await axios.post(`${conf.api.url}/xmpp/credentials`, { }, {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
          crossOrigin: { mode: 'cors' },
        })
        console.log('fetchCredentials response:', response)
        const { user, password, jid } = response.data
        setCredentials({ user, password, jid })
      } catch (err) {
        console.error('xmpp/credentials error:', err)
        setResponseError(err?.response?.data?.message || t('Error retrieving credentials.'))
      } finally {
        setLoading(false)
      }
    }

    fetchCredentials()
  }, [t])

  useEffect(() => {
    if (!credentials || xmppClientRef.current) return;   // prevent re-init

    const initXmpp = async () => {
      try {
        setLoading(true)
        xmppClientRef.current = new XmppClient()
        await xmppClientRef.current.connect({
          credentials,
          service: conf.xmpp.websocketUrl,
          domain: conf.xmpp.host,
        })
        console.log('XMPP initialized:', xmppClientRef.current);
      } catch (err) {
        console.error('Failed to init XMPP:', err);
        setResponseError(t('Error connecting to XMPP.'))
      } finally {
        setLoading(false)
      }
    };

    initXmpp();
  }, [credentials, t]) // `presense` should not be supplied because it should only connect once

  return (
    <XmppContext.Provider value={{ xmppClient: xmppClientRef.current }}>
      {loading && (
        <Loader
          active
          size='large'
          inline='centered'
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
          }}
        />
      )}
      { responseError &&
        <Message
          negative
          icon='exclamation circle'
          header='Error'
          content={responseError}
          onDismiss={() => setResponseError('')}
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '90%',
            maxWidth: '500px',
            textAlign: 'left',
          }}
        />
      }

      {children}
    </XmppContext.Provider>
  )
}

export function ConditionalXmppProvider({ children, user }) {
  if (!user || isEmpty(user) || !user.email ) {
    return children;
  }

  return (<XmppProvider>{children}</XmppProvider>);
}
