import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

import { validatePassword } from './validation'
import { PasswordRequirements } from './Signup'
import { requestLogin } from './Login'
import conf from './conf'
import Logo from './components/Logo'
import { useIndexContext } from './components/IndexContext'

const Reset = () => {
  const { t } = useTranslation('Reset')
  const { setUser, setCountry } = useIndexContext()
  const [ searchParams, ] = useSearchParams()
  const token = searchParams.get("token")
  // console.log('token:', token)

  const navigate = useNavigate()

  const [ password, setPassword ] = useState('')
  const [ repassword, setRepassword ] = useState('')
  const [ passwordValidation, setPasswordValidation ] = useState(validatePassword(''))
  const [ passwordError, setPasswordError ] = useState('')
  const [ repasswordError, setRepasswordError ] = useState('')
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)

  const handleSubmit = async () => {
    setResponseError('')
    let valid = true
    if (!(validatePassword(password)).valid) {
      valid = false
      setPasswordError(t('Please enter a valid password'))
    } else {
      setPasswordError('')
    }
    if (password !== repassword) {
      valid = false
      setRepasswordError(t('Please enter passwords that match'))
    } else {
      setRepasswordError('')
    }
    if (!valid) {
      return
    }

    setLoading(true)
    try {
      let res
      res = await axios.post(`${conf.api.url}/reset`, {
        password,
        token,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      // console.log('reset res:', res)

      const email = res.data.email
      console.log('email:', email)
      await requestLogin({ email, password, rememberme: false, setUser, setCountry })
      navigate(conf.account.start)
    } catch (err) {
      console.error('reset error:', err);
      return setResponseError(err?.response?.data?.message  || t('Error resetting a password.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Grid textAlign='center' style={{ height: '100vh' }} verticalAlign='middle'>
      <Grid.Column style={{ maxWidth: 450 }}>
        <Logo size='large' />
        <Header as='h2' color={conf.style.color0} textAlign='center'>
          {t('Reset Password')}
        </Header>
        <Loader active={loading} inline='centered' style={{ marginBottom: '1em' }}/>
        { responseError &&
          <Message
            negative
            style={{ textAlign: 'left'}}
            icon='exclamation circle'
            header={t('Error')}
            content={responseError}
            onDismiss={() => setResponseError('')}
          />
        }

        <Form size='large'>
          <Segment stacked>
            <Form.Input
              fluid
              icon='lock'
              iconPosition='left'
              placeholder={t('New Password')}
              type='password'
              name='password'
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setPasswordValidation(validatePassword(e.target.value));
              }}
              error={ !isEmpty(passwordError) && {
                content: passwordError,
                pointing: 'above',
              }}
              required
            />
            <Form.Input
              fluid
              icon='repeat'
              iconPosition='left'
              placeholder={t('Repeat Password')}
              type='password'
              name='repassword'
              value={repassword}
              onChange={e => setRepassword(e.target.value)}
              error={ !isEmpty(repasswordError) && {
                content: repasswordError,
                pointing: 'above',
              }}
              required
            />

            <PasswordRequirements
              passwordValidation={passwordValidation}
              passwordsMatch={ password === repassword }
            />

            <Divider />
            <Button color={conf.style.color0} fluid size='large' onClick={handleSubmit}>
              <Icon name='edit outline' />
              {' '}
              {t('Reset password')}
              {' '}
            </Button>
          </Segment>
        </Form>
        <Message>
          {t('Remember password?')}
          {' '}
          <Button
            size='mini'
            style={{ marginLeft: '0.5em' }}
            onClick={() => navigate('/login')}
            icon labelPosition='right'
          >
            {t('Log In')}
            {' '}
            <Icon name='sign-in' />
          </Button>
        </Message>
      </Grid.Column>
    </Grid>
  )
}

export default Reset
