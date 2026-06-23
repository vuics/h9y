import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isEmpty } from 'lodash'
import axios from 'axios'
import {
  Button,
  Form,
  Grid,
  Header,
  Message,
  Segment,
  Icon,
  Loader,
  Divider,
  // Image,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import conf from './conf'
import Logo from './components/Logo'
import { useIndexContext } from './components/IndexContext'
import { setI18nLanguage } from './i18n'

export const requestLogin = async ({ email, password, rememberme, setUser, setCountry }) => {
  try {
    const res = await axios.post(`${conf.api.url}/login`, {
      email,
      password,
      rememberme,
    }, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
      crossOrigin: { mode: 'cors' },
    })
    // console.log('res:', res)
    setUser(res.data.user)
    if (res.data.user.settings?.language) {
      setI18nLanguage(res.data.user.settings.language)
    }
    if (res.data.user.address?.country) {
      setCountry(res.data.user.address.country)
    }
  } catch (err) {
    console.log('Error requesting login:', err)
    throw err
  }
}

export default function Login () {
  const { t } = useTranslation('Login')
  const { setUser, setCountry } = useIndexContext()
  const navigate = useNavigate()

  const [ email, setEmail ] = useState('')
  const [ password, setPassword ] = useState('')
  const [ emailError, setEmailError ] = useState('')
  const [ passwordError, setPasswordError ] = useState('')
  const [ rememberme, setRememberme ] = useState(false)
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)

  const handleSubmit = async () => {
    let valid = true
    if (isEmpty(email)) {
      valid = false
      setEmailError(t('Please enter a valid email address'))
    } else {
      setEmailError('')
    }
    if (isEmpty(password)) {
      valid = false
      setPasswordError(t('Please enter a valid password'))
    } else {
      setPasswordError('')
    }
    if (!valid) {
      return
    }

    setLoading(true)
    try {
      await requestLogin({ email, password, rememberme, setUser, setCountry })
      navigate(conf.account.start)
    } catch (err) {
      console.error('login error:', err);
      return setResponseError(t('Error logging in.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Grid textAlign='center' style={{ height: '100vh' }} verticalAlign='middle'>
      <Grid.Column style={{ maxWidth: 450 }}>
        <Logo size='large' />
        <Header as='h2' color={conf.style.color0} textAlign='center'>
          {t('Log-in to Your Account')}
        </Header>
        <Loader active={loading} inline='centered' style={{ marginBottom: '1em' }}/>
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

        <Form size='large'>
          <Segment stacked>
            <Form.Input
              fluid
              icon='user'
              iconPosition='left'
              placeholder={t('E-mail address')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={ !isEmpty(emailError) && {
                content: emailError,
                pointing: 'above',
              }}
              required
            />
            <Form.Input
              fluid
              icon='lock'
              iconPosition='left'
              placeholder={t('Password')}
              type='password'
              name='password'
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={ !isEmpty(passwordError) && {
                content: passwordError,
                pointing: 'above',
              }}
              required
            />
            <Form.Checkbox
              label={t('Remember Me')}
              checked={rememberme}
              onChange={(e, data) => setRememberme(data.checked)}
            />

            <Button color={conf.style.color0} fluid size='large' onClick={handleSubmit}>
              <Icon name='sign-in' />
              {' '}
              {t('Login')}
              {' '}
            </Button>
          </Segment>
        </Form>
        <Message>
          <label style={{ textAlign: 'left' }}>
            <a href="/forgot">{t('Forgot password?')}</a>
          </label>
          <Divider />
          {t('New to us?')}
          {' '}
          <Button
            size='mini'
            style={{ marginLeft: '0.5em' }}
            onClick={() => navigate('/signup')}
            icon labelPosition='right'
          >
            {t('Sign Up')}
            {' '}
            <Icon name='user plus' />
          </Button>
        </Message>
      </Grid.Column>
    </Grid>
  )
}
