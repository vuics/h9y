import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  Container,
  Loader,
  Message,
  Card,
  Grid,
  Button,
  Checkbox,
  Segment,
  Icon,
  Header,
  Dropdown,
  List,
  Label,
  Popup,
  Menu,
  // Divider,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'
import Form from '@rjsf/semantic-ui'
import validator from '@rjsf/validator-ajv8';
import { JsonEditor } from "json-edit-react";

import Menubar from './components/Menubar'
import conf from './conf'
import archetypes, { defaultArchetype } from './archetypes'
import { useXmppContext } from './components/XmppContext'

export function JsonEditorField (props) {
  console.log('JsonEditorField props:', props)
  return (<>
    <span style={{ color: 'black' }}><b>{props.schema.title}</b></span>
    <div id={props.id} style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8 }}>
      <JsonEditor
        data={props.formData || {}}
        setData={(formData) => { props.onChange(formData) }}
        rootName=''
      />
    </div>
  </>);
}
// })

export const sortDeployed = (a, b) => {
  // 1. Sort by deployed (true first)
  if (a.deployed !== b.deployed) {
    return b.deployed - a.deployed  // true > false → descending
  }

  // 2. Sort by updatedAt (newer first)
  const updatedA = new Date(a.updatedAt || 0)
  const updatedB = new Date(b.updatedAt || 0)

  if (updatedA.getTime() !== updatedB.getTime()) {
    return updatedB - updatedA
  }

  // 3. Sort by createdAt (newer first)
  const createdA = new Date(a.createdAt || 0)
  const createdB = new Date(b.createdAt || 0)

  return createdB - createdA
}

export default function Hive () {
  const { t } = useTranslation('Hive')
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(true)
  const [ agents, setAgents ] = useState([])
  const [ agentsImmutable, setAgentsImmutable ] = useState([])
  const [ archetype, setArchetype ] = useState(defaultArchetype.value)
  const [ category, setCategory ] = useState(defaultArchetype.category)
  const [ adding, setAdding ] = useState(false)
  const fileInputRef = useRef(null);

  const { xmppClient } = useXmppContext()
  const [ roster, setRoster ] = useState(xmppClient?.roster || [])
  const [ presence, setPresence ] = useState(xmppClient?.presence || {});
  // console.log('presence:', presence)
  // console.log('roster:', roster)

  useEffect(() => {
    if (!xmppClient?.emitter) return;
    setRoster(xmppClient.roster)
    setPresence(xmppClient.presence)
    xmppClient.emitter.on('roster', setRoster)
    xmppClient.emitter.on('presence', setPresence)
    return () => {
      xmppClient.emitter.removeListener('roster', setRoster)
      xmppClient.emitter.removeListener('presence', setPresence)
    }
  }, [xmppClient]);

  const indexAgents = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/agent?skip=${conf.hive.skip}&limit=${conf.hive.limit}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('agents index res:', res)
      console.log('res.data:', res.data)
      setAgents(res?.data.sort(sortDeployed) || [])
      setAgentsImmutable(res?.data || [])
    } catch (err) {
      console.error('indexAgents error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting agents.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    indexAgents()
  }, [])

  const postAgent = async ({ agent = null, agentOptions = null } = {}) => {
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/agent`, {
        deployed: false,
        archetype: agent ? agent.archetype : archetype,
        options: agent ? agent.options : agentOptions,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('post agent res:', res)
      setAgents(agents => [res.data, ...agents])
      setAgentsImmutable(agentsImmutable => [res.data, ...agentsImmutable])
      await xmppClient?.addToRoster({
        jid: `${res.data.options.name}@${xmppClient?.credentials.user}.${conf.xmpp.host}`,
        name: res.data.options.name,
        groups: res.data.options.joinRooms,
      })
    } catch (err) {
      console.error('post agent error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error posting agent.'))
    } finally {
      setLoading(false)
    }
  }

  const putAgent = async ({ agent }) => {
    setLoading(true)
    try {
      const res = await axios.put(`${conf.api.url}/agent/${agent._id}`, {
        ...agent,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('agent put res:', res)
      const prevAgent = agentsImmutable.find(a => a._id === agent._id)
      setAgents(agents.map(a => a._id === res.data._id ? res.data : a))
      setAgentsImmutable(agentsImmutable.map(a => a._id === res.data._id ? res.data : a))
      const jid = `${res.data.options.name}@${xmppClient?.credentials.user}.${conf.xmpp.host}`
      const name = res.data.options.name
      const inRoster = roster.find(r => r.jid === jid && r.name === name)
      console.log('jid:', jid, ', name:', name, ', inRoster:', inRoster)
      if (!inRoster) {
        console.log('Agent with name:', res.data.options.name, ', and jid:', jid, 'does not exist in roster. Adding...')
        await xmppClient?.removeFromRoster({
          jid: `${prevAgent.options.name}@${xmppClient?.credentials.user}.${conf.xmpp.host}`,
        })
        await xmppClient?.addToRoster({
          jid,
          name: res.data.options.name,
          groups: res.data.options.joinRooms,
        })
      }
    } catch (err) {
      console.error('put agent error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error putting agent.'))
    } finally {
      setLoading(false)
    }
  }

  const deleteAgent = async ({ _id }) => {
    setLoading(true)
    try {
      const res = await axios.delete(`${conf.api.url}/agent/${_id}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('agent delete res:', res)
      const [deletedAgent] = agents.filter(obj => obj._id === _id)
      setAgents(agents.filter(obj => obj._id !== _id))
      setAgentsImmutable(agentsImmutable.filter(obj => obj._id !== _id))
      await xmppClient?.removeFromRoster({
        jid: `${deletedAgent.options.name}@${xmppClient?.credentials.user}.${conf.xmpp.host}`,
      })
    } catch (err) {
      console.error('delete agent error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error deleting agent.'))
    } finally {
      setLoading(false)
    }
  }

  const downloadAgent = ({ agentId }) => {
    setLoading(true)
    try {
      const agentObj = agents.find(a => a._id === agentId)
      const jsonString = JSON.stringify(agentObj, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${agentObj.options.name}.json`;
      link.click();
      URL.revokeObjectURL(url); // Clean up
    } catch (err) {
      console.error('download agents error:', err);
      return setResponseError(err.toString() || t('Error downloading agents.'))
    } finally {
      setLoading(false)
    }
  };


  const downloadAgents = () => {
    setLoading(true)
    try {
      const jsonString = JSON.stringify(agents, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agents.sda.json`;
      link.click();
      URL.revokeObjectURL(url); // Clean up
    } catch (err) {
      console.error('download agents error:', err);
      return setResponseError(err.toString() || t('Error downloading agents.'))
    } finally {
      setLoading(false)
    }
  };

  const uploadAgents = async (event) => {
    setLoading(true)
    try {
      const file = event.target.files[0];
      if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const parsedAgents = JSON.parse(e.target.result);
            const agentsArray = Array.isArray(parsedAgents)
              ? parsedAgents
              : [parsedAgents];
            for (const agent of agentsArray) {
              await postAgent({ agent })
            }
            console.log('Agents loaded:', agentsArray);
          } catch (err) {
            alert(`${t('Invalid JSON file')}: ${err}`);
          }
        };
        reader.readAsText(file);
      } else {
        alert(t('Please upload a valid JSON file.'))
      }
    } catch (err) {
      console.error('upload agents error:', err);
      return setResponseError(err.toString() || t('Error uploading agent.'))
    } finally {
      setLoading(false)
    }
  };

  const uploadAgentsInit = () => {
    fileInputRef.current.click(); // triggers hidden input
  };

  const log = (type) => console.log.bind(console, type);

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

      { !adding && (
        <div>
        <Button size='large' onClick={() => setAdding(!adding) }>
          <Icon.Group size='large'>
            <Icon name='spy' />
            <Icon corner name='add' />
          </Icon.Group>
          {' '}
          {t('Add Agent')}
          {' '}
        </Button>
        <Button.Group floated='right'>
          <Popup content='Download agents' trigger={
            <Button icon onClick={downloadAgents}>
              <Icon name='download' />
              {t('Download All')}
            </Button>
          } />
          <Popup content='Upload agents' trigger={
            <Button icon onClick={uploadAgentsInit}>
              <Icon name="upload" />
              <input
                type="file"
                accept="application/json"
                ref={fileInputRef}
                onChange={uploadAgents}
                style={{ display: 'none' }} // hide input
              />
              {t('Upload')}
            </Button>
          } />
        </Button.Group>
       </div>
      )}

      { adding && (
        <Segment secondary>
          <Header as='h2'>
            {t('Add Agent')}
          </Header>

          <Menu attached='top' tabular>
            { [...new Set(Object.values(archetypes).filter(ar => ar.enable).map(ar => ar.category))].map(cat => (
              <Menu.Item
                key={cat}
                active={category === cat}
                onClick={() => setCategory(cat)}
              >
              {cat}
              </Menu.Item>
            )) }
          </Menu>
          <Segment attached='bottom'>
            <Menu icon='labeled' horizontal>
              { Object.values(archetypes).filter(ar => ar.enable && ar.category === category).map(c => (
                <Menu.Item
                  key={c.key}
                  name={c.text}
                  active={archetype === c.key}
                  onClick={() => setArchetype(c.key)}
                >
                  <Icon name={c.icon} />
                  {c.text}
                </Menu.Item>
              ))}
            </Menu>
          </Segment>

          <p>
            { archetypes[archetype].text && (<>
              <b>{t('Archetype')}:</b> {archetypes[archetype].text}
              <br/>
            </>)}
            { archetypes[archetype].description && (<>
              <b>{t('Description')}:</b> {archetypes[archetype].description}
              <br/>
            </>)}
            { archetypes[archetype].docUrl && (<>
              <b>{t('Agent Creation Guide')}:</b>{' '}<a href={archetypes[archetype].docUrl} target='_blank' rel="noreferrer">{archetypes[archetype].text}</a>{' '}
              <br/>
            </>)}
          </p>

          <Form
            schema={archetypes[archetype].schema}
            uiSchema={archetypes[archetype].uiSchema || {}}
            fields={{ JsonEditorField }}
            validator={validator}
            onChange={log('changed')}
            onSubmit={({ formData }) => { postAgent({ agentOptions: formData }); setAdding(!adding) }}
            onError={log('errors')}
          >
            <Button.Group>
              <Button type='button' onClick={() => setAdding(!adding) }>
                <Icon name='cancel' />
                {' '}
                {t('Cancel')}
                {' '}
              </Button>
              <Button.Or />
              <Button type='submit' positive on>
                <Icon name='save' />
                {' '}
                {t('Submit')}
                {' '}
              </Button>
            </Button.Group>
          </Form>

        </Segment>
      )}

      <Segment tertiary>
        <Grid>
          { agents.map((agent) => (
            <Grid.Row key={agent._id}>
              <Grid.Column width={agent.editing ? 5 : 16}>
                <Card fluid>
                  <Card.Content>
                    <Card.Header>
                      <Grid>
                        <Grid.Row>
                          <Grid.Column width={agent.editing ? 13 : 15}>
                            <Icon
                              name={
                                presence[`${agent.options.name}@${xmppClient?.credentials?.user}.${conf.xmpp.host}`]
                                  ? (agent.deployed ? archetypes[agent.archetype].icon : 'spinner')
                                  : (agent.deployed ? 'spinner' : archetypes[agent.archetype].icon)
                              }
                              color={
                                presence[`${agent.options.name}@${xmppClient?.credentials?.user}.${conf.xmpp.host}`]
                                  ? (agent.deployed ? 'green' : 'red')
                                  : (agent.deployed ? 'yellow' : 'grey')
                              }
                              loading={
                                presence[`${agent.options.name}@${xmppClient?.credentials?.user}.${conf.xmpp.host}`]
                                  ? (agent.deployed ? false : true)
                                  : (agent.deployed ? true : false)
                              }
                            />
                            {agent.options?.name || '(no name)'}
                          </Grid.Column>
                          <Grid.Column width={agent.editing ? 3 : 1}>
                            <Dropdown item simple position='right'
                              icon={
                               <Icon name='cog' color='grey'/>
                              }>
                              <Dropdown.Menu>
                                <Dropdown.Item
                                  onClick={() => {
                                    setAgents(agents.map(a =>
                                      a._id === agent._id ? { ...a, editing: true } : a
                                    ))
                                  }}
                                >
                                  <Icon name='edit' />
                                  {t('Edit')}
                                </Dropdown.Item>
                                <Dropdown.Item
                                  onClick={() => {
                                    downloadAgent({ agentId: agent._id })
                                  }}
                                >
                                  <Icon name='download' />
                                  {t('Download')}
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item
                                  onClick={() => {
                                    deleteAgent({ _id: agent._id })
                                  }}
                                >
                                  <Icon name='delete' />
                                  {t('Delete')}
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </Grid.Column>
                        </Grid.Row>
                      </Grid>
                    </Card.Header>
                    <Card.Meta textAlign='left'>
                      { archetypes[agent.archetype]?.text }
                    </Card.Meta>
                    <Card.Description>
                      {agent.options?.description || t('(no description)') }
                    </Card.Description>
                    { agent.options?.joinRooms?.length > 0 && (
                      <List>
                      { agent.options?.joinRooms?.map(room => (
                          <Label key={room}><List.Item>{room}</List.Item></Label>
                      ))}
                      </List>
                    ) }
                  </Card.Content>
                  <Card.Content extra>
                    <Checkbox toggle label={t('Deployed')}
                      disabled={agent.editing}
                      onChange={(e, data) => {
                        putAgent({ agent: {...agent, deployed: data.checked } })
                      }}
                      checked={agent.deployed}
                    />
                    { agent.options.expire && (<>
                      <Label style={{ marginLeft: '1rem' }}>
                        <Icon name='hourglass half' />
                        {t('Expiry')}: {agent.options.expire}
                      </Label>
                    </>)}
                  </Card.Content>
                  { agent.editing && (
                    <Card.Content extra>
                      <div className='ui two buttons'>
                        <Button basic color='grey'
                          onClick={() => {
                            const foundAgent = agentsImmutable.find(a => a._id === agent._id)
                            setAgents(agents.map(a =>
                              a._id === agent._id ? { ...foundAgent, editing: false } : a
                            ))
                          }}
                        >
                        {t('Cancel')}
                        </Button>
                        { agent.edited && (
                          <Button color='yellow'
                            onClick={() => {
                              putAgent({ agent: { ...agent, options: agent.options }});
                            }}
                          >
                          {t('Update')}
                          </Button>
                        )}
                      </div>
                  </Card.Content>
                  ) }
                </Card>
              </Grid.Column>
              { agent.editing && (
                <Grid.Column width={11}>
                  <Segment secondary>
                    <Header as='h3'>
                      {t('Edit Agent')}
                    </Header>
                    <Form
                      schema={archetypes[agent.archetype].schema}
                      uiSchema={archetypes[agent.archetype].uiSchema || {}}
                      fields={{ JsonEditorField }}
                      validator={validator}
                      formData={agent.options}
                      onChange={({ formData }) => {
                        setAgents(agents.map(a =>
                          a._id === agent._id ? { ...agent, edited: true, options: formData } : a
                        ))
                      }}
                      onSubmit={({ formData }) => {
                        putAgent({ agent: { ...agent, options: formData }});
                      }}
                      onError={log('errors')}
                    >
                      <Button.Group>
                        <Button type='button' onClick={() => {
                          const foundAgent = agentsImmutable.find(a => a._id === agent._id)
                          setAgents(agents.map(a =>
                            a._id === agent._id ? { ...foundAgent, editing: false } : a
                          ))
                        }}>
                          <Icon name='cancel' />
                          {' '}
                          {t('Cancel')}
                          {' '}
                        </Button>
                        <Button.Or />
                        <Button type='submit' color='yellow' on>
                          <Icon name='save' />
                          {' '}
                          {t('Update')}
                          {' '}
                        </Button>
                      </Button.Group>
                    </Form>
                  </Segment>
                </Grid.Column>
              )}
            </Grid.Row>
          ))}
        </Grid>
      </Segment>
    </Container>
  </>)
}
