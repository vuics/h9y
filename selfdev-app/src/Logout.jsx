import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Grid,
  Header,
  Image,
  Message,
  Loader,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import conf from './conf'
import { useIndexContext } from './components/IndexContext'
import Logo from './components/Logo'

const Logout = () => {
  const { t } = useTranslation('Logout')
  const navigate = useNavigate()
  const { clearUser } = useIndexContext()

  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)

  const logOut = async () => {
    setLoading(true)
    try {
      clearUser()

      const res = await axios.get(`${conf.api.url}/logout`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      // console.log('res:', res)

      navigate('/')
    } catch (err) {
      console.error('logout error:', err);
      return setResponseError(err?.response?.data?.message || 'Error logging out.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    logOut()
  }, [])

  return (
    <Grid textAlign='center' style={{ height: '100vh' }} verticalAlign='middle'>
      <Grid.Column style={{ maxWidth: 450 }}>
        <Logo size='large' gray />
        <Header as='h2' color={conf.style.color0} textAlign='center'>
          {t('Log Out')}
        </Header>
        <Loader active={loading} inline='centered' />
        { responseError &&
          <Message
            negative
            style={{ textAlign: 'left'}}
            icon='exclamation circle'
            header='Error'
            content={responseError}
            onDismiss={() => setResponseError('')}
          />
        }
      </Grid.Column>
    </Grid>
  )
}

export default Logout
