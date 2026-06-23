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
  List,
  Icon,
  Loader,
  Divider,
  // Label,
  // Dropdown,
  // Image,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import conf from './conf'
import { validateEmail, validatePhone, validatePassword } from './validation'
import { requestLogin } from './Login'
import Logo from './components/Logo'
import { useIndexContext } from './components/IndexContext'
import { LanguageSelector } from './i18n'
import { CountryFormField } from './components/Countries'

export const PasswordRequirements = ({ passwordValidation, passwordsMatch }) => {
  const { t } = useTranslation('Signup')
  return (
    <div style={{ textAlign: 'left' }}>
      {t('The password should satisfy the following criteria')}:
      <List bulleted style={{marginTop: '0.5em' }}>
        <List.Item style={{ color: passwordValidation.upperCase ? 'green' : 'red'}}>
        {t('At least one upper case English letter.')}
        </List.Item>
        <List.Item style={{ color: passwordValidation.lowerCase ? 'green' : 'red'}}>
        {t('At least one lower case English letter.')}
        </List.Item>
        <List.Item style={{ color: passwordValidation.digit ? 'green' : 'red'}}>
        {t('At least one digit.')}
        </List.Item>
        <List.Item style={{ color: passwordValidation.special ? 'green' : 'red'}}>
        {t('At least one special character.')}
        </List.Item>
        <List.Item style={{ color: passwordValidation.length ? 'green' : 'red'}}>
        {t('Minimum length is 8 characters.')}
        </List.Item>
        <List.Item style={{ color: passwordsMatch ? 'green' : 'red'}}>
        {t('Passwords match.')}
        </List.Item>
      </List>
    </div>
  )
}

export default function Signup () {
  const { t, i18n } = useTranslation('Signup')
  const { setUser, country, setCountry } = useIndexContext()
  const navigate = useNavigate()

  const [ firstName, setFirstName ] = useState('')
  const [ lastName, setLastName ] = useState('')
  const [ email, setEmail ] = useState('')
  const [ phone, setPhone ] = useState('')
  const [ password, setPassword ] = useState('')
  const [ repassword, setRepassword ] = useState('')
  const [ passwordValidation, setPasswordValidation ] = useState(validatePassword(''))
  const [ firstNameError, setFirstNameError ] = useState('')
  const [ lastNameError, setLastNameError ] = useState('')
  const [ emailError, setEmailError ] = useState('')
  const [ phoneError, setPhoneError ] = useState('')
  const [ passwordError, setPasswordError ] = useState('')
  const [ repasswordError, setRepasswordError ] = useState('')
  const [ responseError, setResponseError ] = useState('')
  const [ countryError, setCountryError ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ termsConsent, setTermsConsent ] = useState(false)
  const [ privacyConsent, setPrivacyConsent ] = useState(false)
  const [ marketingConsent, setMarketingConsent ] = useState(false)

  const handleSubmit = async () => {
    setResponseError('')
    let valid = true
    if (isEmpty(firstName)) {
      valid = false
      setFirstNameError(t('Please enter a valid first name'))
    } else {
      setFirstNameError('')
    }
    if (isEmpty(lastName)) {
      valid = false
      setLastNameError(t('Please enter a valid last name'))
    } else {
      setLastNameError('')
    }
    if (!validateEmail(email)) {
      valid = false
      setEmailError(t('Please enter a valid email address'))
    } else {
      setEmailError('')
    }
    if (phone && !validatePhone(phone)) {
      valid = false
      setPhoneError(t('Please enter a valid phone'))
    } else {
      setPhoneError('')
    }
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
    if (isEmpty(country)) {
      valid = false
      setCountryError(t('Please select your country'))
    } else {
      setCountryError('')
    }
    if (!valid) {
      return
    }

    setLoading(true)
    try {
      let res
      // eslint-disable-next-line no-unused-vars
      res = await axios.post(`${conf.api.url}/signup`, {
        firstName,
        lastName,
        email,
        phone,
        password,
        country,
        language: i18n.language,
        termsConsent,
        privacyConsent,
        marketingConsent,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      // console.log('signup res:', res)

      await requestLogin({ email, password, rememberme: false, setUser, setCountry })
      navigate(conf.account.start)
    } catch (err) {
      console.error('signup error:', err);
      return setResponseError(err?.response?.data?.message  || t('Error registering a user account.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Grid textAlign='center' style={{ height: '100vh' }} verticalAlign='middle'>
      <Grid.Column style={{ maxWidth: 700 }}>
        <Header as='h2' color={conf.style.color0} textAlign='center'>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}>
            <Logo size='tiny' />
            <span>
              {t('Create a New Account')}
            </span>
          </div>
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
            <LanguageSelector fluid />
            <Divider />

            <Form.Input fluid
              icon='user'
              iconPosition='left'
              placeholder={t('First Name')}
              name='firstName'
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              error={ !isEmpty(firstNameError) && {
                content: firstNameError,
                pointing: 'above',
              }}
              required
            />
            <Form.Input
              fluid
              icon='user outline'
              iconPosition='left'
              placeholder={t('Last Name')}
              name='lastName'
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              error={ !isEmpty(lastNameError) && {
                content: lastNameError,
                pointing: 'above',
              }}
              required
            />
            <Form.Input
              fluid
              icon='at'
              iconPosition='left'
              placeholder={t('E-mail address')}
              name='email'
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
              icon='phone'
              iconPosition='left'
              placeholder={t('Phone (optionally)')}
              name='phone'
              value={phone}
              onChange={e => setPhone(e.target.value)}
              error={ !isEmpty(phoneError) && {
                content: phoneError,
                pointing: 'above',
              }}
            />

            <Form.Input
              fluid
              icon='lock'
              iconPosition='left'
              placeholder={t('Password')}
              type='password'
              name='password'
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordValidation(validatePassword(e.target.value)); }}
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
            <CountryFormField fluid countryError={countryError} />

            <Form.Group>
              <Form.Checkbox
                label={
                  <label style={{ textAlign: 'left' }}>
                    {t('I have read and agree to the')}
                    {' '}
                    <a href="/terms" target="_blank">
                      {t('terms of service')}
                    </a>
                    .
                  </label>
                }
                checked={termsConsent}
                onChange={(e, data) => setTermsConsent(data.checked)}
              >
              </Form.Checkbox>
            </Form.Group>
            <Form.Group>
              <Form.Checkbox
                label={
                  <label style={{ textAlign: 'left' }}>
                    {t('I have read and agree to the')}
                    {' '}
                    <a href="/privacy" target="_blank">
                      {t('privacy policy')}
                    </a>
                    .
                  </label>
                }
                checked={privacyConsent}
                onChange={(e, data) => setPrivacyConsent(data.checked)}
              >
              </Form.Checkbox>
            </Form.Group>
            <Form.Group>
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
            </Form.Group>
            <Button
              color={conf.style.color0}
              fluid
              size='large'
              onClick={handleSubmit}
              disabled={!termsConsent || !privacyConsent}
            >
              <Icon name='user plus' />
              {' '}
              {t('Sign Up')}
              {' '}
             </Button>
          </Segment>
        </Form>
        <Message>
          {t('Have an existing account?')}
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
