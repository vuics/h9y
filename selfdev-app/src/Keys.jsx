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
  Table,
  Popup,
  Input,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import Menubar from './components/Menubar'
import conf from './conf'

export default function Keys () {
  const { t } = useTranslation('Keys')
  const [ keys, setKeys ] = useState([])
  const [ name, setName ] = useState('')
  const [ visible, setVisible ] = useState(null)
  const [ nameError, setNameError ] = useState('')
  const [ responseError, setResponseError ] = useState('')
  const [ responseMessage, setResponseMessage ] = useState('')
  const [ adding, setAdding ] = useState(false)
  const [ loading, setLoading ] = useState(false)

  const getKeys = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/key`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('keys index res:', res)
      setKeys(res?.data || [])
    } catch (err) {
      console.error('getKeys error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting keys.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getKeys()
  }, [])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/key`, {
        name,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('post key res:', res)
      // setResponseMessage(`${res.statusText} API key "${res.data.name}"`)
      keys.push(res.data)
      setKeys(keys)
      setName('')
    } catch (err) {
      console.error('post key error:', err);
      return setResponseError(err.toString() || t('Error posting a key.'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async ({ _id, name }) => {
    setLoading(true)
    try {
      const res = await axios.delete(`${conf.api.url}/key/${_id}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('delete key res:', res)
      // setResponseMessage(`API key "${name}" deleted`)
      setKeys(keys.filter(obj => obj._id !== _id))
    } catch (err) {
      console.error('delete key error:', err);
      return setResponseError(err.toString() || t('Error deleting key.'))
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
          {t('API Keys')}
        </Header>

        <Table striped>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>
                {t('Name')}
              </Table.HeaderCell>
              <Table.HeaderCell>
                {t('Key')}
              </Table.HeaderCell>
              <Table.HeaderCell>
                {t('Created At')}
              </Table.HeaderCell>
              <Table.HeaderCell>
                {t('Last Used At')}
              </Table.HeaderCell>
              <Table.HeaderCell textAlign='right'>
                {t('Actions')}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            { keys.map(({ _id, name, key, secret, createdAt, lastUsedAt }) => (
              <Table.Row key={_id}>
                <Table.Cell>{ name }</Table.Cell>
                <Table.Cell>
                  <Input
                    type={ visible === _id ? 'text': 'password' }
                    defaultValue={ key+':'+secret }
                    action
                  >
                    <input />
                    <Button icon onClick={() => { setVisible(visible === _id ? null : _id) }}>
                      <Icon name='eye' />
                    </Button>
                    <Popup
                      content={t('Copied')}
                      on='click'
                      pinned
                      trigger={
                        <Button icon onClick={() => { navigator.clipboard.writeText(`${key}:${secret}`) }}>
                          <Icon name='copy' />
                        </Button>
                      }
                    />
                  </Input>
                </Table.Cell>
                <Table.Cell>{ new Date(createdAt).toLocaleDateString() }</Table.Cell>
                <Table.Cell>{ lastUsedAt && new Date(lastUsedAt).toLocaleDateString() }</Table.Cell>
                <Table.Cell textAlign='right'>
                  <Button icon onClick={() => { handleDelete({ name, _id }) }}>
                    <Icon name='trash' />
                  </Button>
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
            {t('Add Key')}
          </Button>
        )}

        { adding && (
          <Form>
            <Segment stacked>
              <Header as='h4'>Add Key</Header>
              <Form.Input fluid
                icon='key'
                iconPosition='left'
                placeholder={t('Key Name')}
                name='name'
                value={name}
                onChange={e => setName(e.target.value)}
                error={ !isEmpty(nameError) && {
                  content: nameError,
                  pointing: 'above',
                }}
                required
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
                  onClick={() => { handleSubmit(); setAdding(!adding) }}
                >
                  <Icon name='save' />
                  {t('Submit')}
                </Button>
              </Button.Group>
            </Segment>
          </Form>
        )}
      </Segment>

      <Segment>
        {t('You can read the')}
        {' '}<a href='https://github.com/vuics/selfdev-js/blob/main/API.md' target='_blank' rel="noreferrer">API.md</a>{' '}
        {t('document to learn more about the Self-developing API.')}
      </Segment>

      <Segment>
        {t('Check the')}
        {' '}<a href='https://github.com/vuics/selfdev-js' target='_blank' rel="noreferrer">selfdev-js</a>{' '}
        {t('tool on GitHub to use the Self-developing AI from command line.')}
      </Segment>
    </Container>
  </>)
}
