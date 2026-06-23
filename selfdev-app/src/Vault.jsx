import React, { useState, useEffect } from 'react'
import { isEmpty, has } from 'lodash'
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
  Table,
  Popup,
  Input,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import Menubar from './components/Menubar'
import conf from './conf'

export default function Vault () {
  const { t } = useTranslation('Vault')
  const [ vault, setVault ] = useState({})
  const [ key, setKey ] = useState('')
  const [ keyError, setKeyError ] = useState('')
  const [ value, setValue ] = useState('')
  const [ valueError, setValueError ] = useState('')
  const [ visibles, setVisibles ] = useState([])
  const [ responseError, setResponseError ] = useState('')
  const [ responseMessage, setResponseMessage ] = useState('')
  const [ adding, setAdding ] = useState(false)
  const [ loading, setLoading ] = useState(false)

  const getVault = async () => {
    setLoading(true)
    setVisibles([])
    try {
      const res = await axios.get(`${conf.api.url}/vault`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('vault index res:', res)
      setVault(res?.data || {})
    } catch (err) {
      console.error('getVault error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting vault.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getVault()
  }, [])

  const exposeSecret = async ({ key, copy = false } = {}) => {
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/vault/expose`, {
        key,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('post vault res:', res)
      // setResponseMessage(`${res.statusText} vault "${res.data}"`)
      setVault(prevVault => ({
        ...prevVault,
        ...res?.data,
      }));
      if (copy) {
        navigator.clipboard.writeText(res?.data[key])
      }
    } catch (err) {
      console.error('post vault error:', err);
      return setResponseError(err.toString() || t('Error posting vault.'))
    } finally {
      setLoading(false)
    }
  }

  const addSecret = async () => {
    setVisibles([])
    if (!key) {
      return setKeyError(t('Key is empty'))
    }
    if (has(vault, key)) {
      return setKeyError(t('The key already exists'))
    }
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/vault`, {
        key,
        value
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('post vault res:', res)
      // setResponseMessage(`${res.statusText} vault "${res.data}"`)
      setVault(res?.data || {})
      setKey('')
      setKeyError('')
      setValue('')
      setValueError('')
      setAdding(!adding)
    } catch (err) {
      console.error('post vault error:', err);
      return setResponseError(err.toString() || t('Error posting vault.'))
    } finally {
      setLoading(false)
    }
  }

  const deleteSecret = async ({ key }) => {
    setVisibles([])
    setLoading(true)
    try {
      const res = await axios.delete(`${conf.api.url}/vault`, {
        data: { key },
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        // crossOrigin: { mode: 'cors' },
      })
      // console.log('delete vault res:', res)
      // setResponseMessage(`API vault "${name}" deleted`)
      setVault(res?.data || {})
    } catch (err) {
      console.error('delete vault error:', err);
      return setResponseError(err.toString() || t('Error deleting vault.'))
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
          header={t('Error')}
          content={responseError}
          onDismiss={() => setResponseError('')}
        />
      }
      { responseMessage &&
        <Message
          positive
          style={{ textAlign: 'left'}}
          icon='info circle'
          header={t('Info')}
          content={responseMessage}
          onDismiss={() => setResponseMessage('')}
        />
      }

      <Segment secondary>
        <Header as='h3'>
          {t('Vault')}
        </Header>

        <Table striped>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>
                {t('Key')}
              </Table.HeaderCell>
              <Table.HeaderCell>
                {t('Value')}
              </Table.HeaderCell>
              <Table.HeaderCell textAlign='right'>
                {t('Actions')}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            { Object.entries(vault).map(([key, value]) => (
              <Table.Row key={key}>
                <Table.Cell width={5}>{ key }</Table.Cell>
                <Table.Cell width={9}>
                  <Input
                    type={ visibles.includes(key) ? 'text': 'password' }
                    value={ value === null ? '***************************' : value }
                    action
                    fluid
                  >
                    <input />
                      <Popup content={t('Expose the secret value')} trigger={
                        <Button
                          icon
                          onClick={() => {
                            if (visibles.includes(key)) {
                              setVisibles(prev => prev.filter(k => k !== key));
                            } else {
                              exposeSecret({ key });
                              setVisibles(prev => [...prev, key]);
                            }
                          }}
                        >
                          <Icon name={ visibles.includes(key) ? 'eye slash' : 'eye' } />
                        </Button>
                      } />
                      <Popup content={t('Copy the secret value')} trigger={
                        <Button icon onClick={async () => { exposeSecret({ key, copy: true });  }}>
                          <Icon name='copy' />
                        </Button>
                      } />
                  </Input>
                </Table.Cell>
                <Table.Cell width={1} textAlign='right'>
                  <Popup content={t('Delete the key-value secret')} trigger={
                    <Button icon onClick={() => { deleteSecret({ key }) }}>
                      <Icon name='trash' />
                    </Button>
                  } />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>

        { !adding && (
          <Button
            icon labelPosition='left'
            onClick={() => setAdding(!adding) }
          >
            <Icon name='add' />
            {t('Add Key/Value')}
          </Button>
        )}

        { adding && (
          <Form>
            <Segment stacked>
              <Header as='h4'>Add Key/Value Secret</Header>
              <Form.Input fluid
                icon='key'
                iconPosition='left'
                placeholder={t('Key')}
                name='key'
                value={key}
                onChange={e => setKey(e.target.value)}
                error={ !isEmpty(keyError) && {
                  content: keyError,
                  pointing: 'above',
                }}
                required
              />
              <Form.Input fluid
                icon='envelope'
                iconPosition='left'
                placeholder={t('Value')}
                name='value'
                value={value}
                onChange={e => setValue(e.target.value)}
                error={ !isEmpty(valueError) && {
                  content: valueError,
                  pointing: 'above',
                }}
              />
              <Button.Group>
                <Button
                  icon labelPosition='left'
                  onClick={() => setAdding(!adding) }
                >
                  <Icon name='cancel' />
                  {t('Cancel')}
                </Button>
                <Button.Or />
                <Button
                  positive
                  icon labelPosition='left'
                  onClick={() => { addSecret() }}
                >
                  <Icon name='save' />
                  {t('Submit')}
                </Button>
              </Button.Group>
            </Segment>
          </Form>
        )}
      </Segment>

      <Message info>
        <Message.Header>
          {t('Your keys are safely protected and securely stored.')}
        </Message.Header>
        <p>
          {t('We use advanced encryption methods...')}
        </p>
      </Message>
    </Container>
  </>)
}
