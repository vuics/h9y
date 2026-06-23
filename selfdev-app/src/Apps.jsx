import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Container,
  Segment,
  Loader,
  Message,
  Header,
  Input,
  Button,
  Icon,
  List,
  Label,
  Confirm,
  // Checkbox,
  // Form,
  // Table,
  // Popup,
  // Dropdown,
  // Divider,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'
import CodeMirror from '@uiw/react-codemirror';
// import { isEmpty } from 'lodash'

import Menubar from './components/Menubar'
import conf from './conf'
// import { sleep } from './helper'

function compareSemver(v1, v2) {
  // Remove 'v' prefix if present
  const parse = v => v.replace(/^v/, '').split('.').map(Number);

  const [major1, minor1, patch1] = parse(v1);
  const [major2, minor2, patch2] = parse(v2);

  if (major1 === major2 && minor1 === minor2 && patch1 === patch2) {
    return 'equal';
  } else if (
    major2 > major1 ||
    (major2 === major1 && minor2 > minor1) ||
    (major2 === major1 && minor2 === minor1 && patch2 > patch1)
  ) {
    return 'upgrade';
  } else {
    return 'downgrade';
  }
}

export default function Apps () {
  const { t } = useTranslation('Apps')
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ searching, setSearching ] = useState(false)
  const [ apps, setApps ] = useState([])
  const [ candidates, setCandidates ] = useState([])
  const [ appName, setAppName ] = useState('')
  const [ confirmPurchase, setConfirmPurchase ] = useState(false)
  const [ values, setValues ] = useState('')
  const [ showValues, setShowValues ] = useState(false)
  const [ appToUninstall, setAppToUninstall ] = useState(null);

  // Handles links like:
  //   <a href="web+hyag://hello-world@0.0.1">link</a>
  //   <a href="web+hyag://hello-market@0.0.2">link</a>
  // Based on registerProtocolHandler in ./index.jsx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uri = params.get("uri");
    if (uri) {
      console.log("Protocol invoked with:", uri);

      try {
        // If uri is not a valid URL, this will throw — so catch it
        const parsed =
          uri.startsWith("http") || uri.includes("://")
            ? new URL(uri)
            : new URL(`${conf.protocol.proto}://${uri}`);

        console.log("Host:", parsed.hostname, "Params:", parsed.searchParams);
      } catch (err) {
        console.warn("Invalid URI:", uri, err);
      }
      setAppName(uri)
    }
  }, []);

  // console.log('approvalData:', approvalData)

  const getApps = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/app`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('res:', res)
      console.log('res.data:', res.data)
      // setAddress(res.data.address)
      setApps(res.data)
    } catch (err) {
      console.error('get apps error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting apps.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getApps()
  }, [])

  const searchApp = async () => {
    setSearching(true)
    try {
      if (!appName) {
        setCandidates([])
      } else {
        const res = await axios.post(`${conf.api.url}/apps/search`, {
          appName,
        }, {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
        })
        // console.log('res:', res)
        console.log('res.data:', res.data)
        setCandidates(res.data)
      }
    } catch (err) {
      console.error('App install error:', err);
      return setResponseError(err?.response?.data?.message || t('Error searching app.'))
    } finally {
      setSearching(false)
    }
  }

  const installApp = async ({ appName }) => {
    // NOTE: appName argument redefines the state
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/apps/install`, {
        appName,
        values,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('res:', res)
      console.log('res.data:', res.data)
      getApps()
      setCandidates([])
    } catch (err) {
      console.error('App install error:', err);
      return setResponseError(err?.response?.data?.message || t('Error installing app.'))
    } finally {
      setLoading(false)
    }
  }

  const uninstallApp = async ({ appId }) => {
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/apps/uninstall`, {
        appId
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('res:', res)
      console.log('res.data:', res.data)
      getApps()
    } catch (err) {
      console.error('App uninstall error:', err);
      return setResponseError(err?.response?.data?.message || t('Error uninstalling app.'))
    } finally {
      setLoading(false)
    }
  }

  const deployApp = async ({ appId, deployed }) => {
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/apps/deploy`, {
        appId,
        deployed,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('res.data:', res.data)
    } catch (err) {
      console.error('App deploy error:', err);
      return setResponseError(err?.response?.data?.message || t('Error deploying app.'))
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
          {t('Install a HyperAgent')}
        </Header>

        <Input
          loading={searching}
          icon='search'
          iconPosition='left'
          type='text' placeholder={t('Package name...')} action
          fluid
          value={appName}
          onChange={e => setAppName(e.target.value)}
        >
          <Icon name='search' />
          <input />
          <Button
            icon
            onClick={() => { setAppName(''); setCandidates([]) }}
          >
            <Icon name='x' />
          </Button>
          <Button
            icon
            color={conf.style.color0}
            onClick={searchApp}
          >
            <Icon name='search' />
            {t('Search')}
          </Button>
        </Input>
        <p style={{ margin: '5px 0' }}>
          {t('Examples')}:{' '}
          <Button
            compact standard size='mini'
            onClick={() => setAppName('hello-world@latest')}
          >
            hello-world@latest
          </Button>
          <Button
            compact standard size='mini'
            onClick={() => setAppName('hello-market')}
          >
            hello-market
          </Button>
          <Button
            compact standard size='mini'
            onClick={() => setAppName('hello-template')}
          >
            hello-template
          </Button>
          <Button
            compact standard size='mini'
            onClick={() => setAppName('metaagent')}
          >
            metaagent
          </Button>
          <Button
            compact standard size='mini'
            onClick={() => setAppName('bridge-collection')}
          >
            bridge-collection
          </Button>
        </p>
        <p>
          {t('Browse more HyperAgent packages in the')}{' '}
          <a href={conf.apps.registryUrl} target="_blank" rel="noopener noreferrer">
            {t('Registry')}
          </a>
          .
        </p>
      </Segment>

      { candidates?.length > 0 && (
        <Segment inverted color='grey'>
          <Header as='h3'>
            {t('Found HyperAgents')}
          </Header>

          {candidates.map(candidate => {
            const pricing = candidate.package['x-hyag']?.pricing
            const installedApp = apps.find(a => a.package.name === candidate.package.name)
            let versionAction = 'equal'
            if (installedApp) {
              versionAction = compareSemver(installedApp.package.version, candidate.package.version)
            }
            return (
              <Segment key={candidate.package._id}>
                <Header as="h3">
                  <a
                    href={`${conf.apps.registryUrl}/-/web/detail/${candidate.package.name}/v/${candidate.package.version}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    {candidate.package.name}
                  </a>
                  <Label>{candidate.package.version}</Label>
                </Header>
                <p>{candidate.package.description}</p>
                <List>
                  <List.Item>
                    <strong>{t('Author')}:</strong> {candidate.package.author}
                  </List.Item>
                  <List.Item>
                    <strong>{t('License')}:</strong> <Label>{candidate.package.license}</Label>
                  </List.Item>
                  { pricing && (<>
                    <List.Item>
                      <strong>{t('Price')}:</strong>
                      {' '}{pricing.price}
                      {' '}{pricing.symbol}
                      {' '}{pricing.tokenIndex}
                      {' '}{pricing.model}
                      {' '}{pricing.interval}
                    </List.Item>
                  </>)}
                </List>
                <Button
                  disabled={candidate.installed}
                  color={
                    candidate.installed
                      ? versionAction === 'equal'
                        ? 'grey'
                        : versionAction === 'upgrade'
                          ? 'orange'
                          : 'red'
                      : pricing?.price
                        ? (candidate.purchased ? 'olive' : 'yellow')
                        : 'green'
                  }
                  onClick={() => {
                    if (!(pricing?.price) || candidate.purchased) {
                      installApp({ appName: `${candidate.package.name}@${candidate.package.version}` })
                    } else {
                      setConfirmPurchase(true);
                    }
                  }}
                >
                  {
                    candidate.installed
                      ? versionAction === 'equal'
                        ? t('Installed')
                        : versionAction === 'upgrade'
                          ? t('Upgrade possible')
                          : t('Downgrade possible')
                      : pricing?.price
                          ? (candidate.purchased ? t('Install (Already Purchased)') : t('Buy'))
                          : t('Install')
                  }
                </Button>
                <Confirm
                  open={confirmPurchase}
                  header={t('Confirm Purchase')}
                  content={<>
                    <p style={{ padding: '2rem' }}>
                      {t('You are about to purchase the app')}{' '}
                      <strong>{candidate.package.name}</strong>{' '}
                      {t('for')}{' '}
                      <strong>
                        {' '}{pricing?.price}
                        {' '}{pricing?.symbol}
                      </strong>
                        {' '}{pricing?.tokenIndex}
                        {' '}{pricing?.model}{pricing?.interval && ' '}{pricing?.interval}.
                      <br /><br />
                      {t('Your wallet will be used to complete this transaction.')}{' '}
                      <strong>{t('Do you want to continue?')}</strong>
                    </p>
                  </>}
                  cancelButton={t('Cancel')}
                  confirmButton={t('Buy Now')}
                  onCancel={() => setConfirmPurchase(false)}
                  onConfirm={() => {
                    setConfirmPurchase(false);
                    installApp({ appName: `${candidate.package.name}@${candidate.package.version}` });
                  }}
                >
                </Confirm>

                <Button icon
                  onClick={() => setShowValues(!showValues)}
                >
                  <Icon name={ showValues ? 'caret down' : 'caret right' } />
                  {t('Edit values')}
                </Button>

                { showValues && (<>
                  <br />
                  <br />
                  {t('Values in YAML or JSON format')}:
                  <CodeMirror
                    value={values}
                    onChange={setValues}
                    editable
                    basicSetup={{
                      syntaxHighlighting: 'yaml',
                      highlightActiveLine: false,
                      lineNumbers: true,
                      foldGutter: true,
                      autocompletion: true,
                      closeBrackets: true,
                      bracketMatching: true,
                      indentOnInput: true,
                      highlightSpecialChars: true,
                      history: true,
                      drawSelection: true,
                      allowMultipleSelections: true,
                      rectangularSelection: true,
                      highlightSelectionMatches: true,
                      dropCursor: true,
                      crosshairCursor: true,
                      closeBracketsKeymap: true,
                      defaultKeymap: true,
                      searchKeymap: true,
                      historyKeymap: true,
                      foldKeymap: true,
                      completionKeymap: true,
                      lintKeymap: true,
                    }}
                    theme='light'
                    className="nodrag nopan"
                  />
                </>)}

              </Segment>
            )
          })}
        </Segment>
      )}

      { apps?.length > 0 && !(candidates?.length) && (
        <Segment secondary>
          <Header as='h3'>
            {t('Installed HyperAgents')}
          </Header>

          {apps.map(app => (
            <Segment key={app._id}>
              <Header as="h3">
                <a
                  href={`${conf.apps.registryUrl}/-/web/detail/${app.package.name}/v/${app.package.version}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  {app.package.name}
                </a>
                <Label>{app.package.version}</Label></Header>
              <p>{app.package.description}</p>
              <List>
                <List.Item>
                  <strong>{t('Author')}:</strong> {app.package.author}
                </List.Item>
                <List.Item>
                  <strong>{t('License')}:</strong> <Label>{app.package.license}</Label>
                </List.Item>
                <List.Item>
                  <strong>{t('Installed')}:</strong> {new Date(app.createdAt).toLocaleString()}
                </List.Item>
                <List.Item>
                  <strong>{t('Maps')}:</strong> {app.mapIds?.length || 0} {app.mapIds?.length === 1 ? t('map') : t('maps')}{' '}
                  • <strong>{t('Hive')}:</strong> {app.agentIds?.length || 0} {app.agentIds?.length === 1 ? t('agent') : t('agents')}{' '}
                  • <strong>{t('Omni')}:</strong> {app.bridgeIds?.length || 0} {app.bridgeIds?.length === 1 ? t('bridge') : t('bridges')}{' '}
                </List.Item>
              </List>
              <Button positive onClick={() => deployApp({ appId: app._id, deployed: true })}>
                {t('Deploy')}
              </Button>
              <Button color='yellow' onClick={() => deployApp({ appId: app._id, deployed: false })}>
                {t('Undeploy')}
              </Button>
              <Button negative onClick={() => setAppToUninstall(app)}>
                {t('Uninstall')}
              </Button>
            </Segment>
          ))}

          <Confirm
            open={!!appToUninstall}
            header={t('Confirm Uninstall')}
            content={
              appToUninstall && (
                <p style={{ padding: '2rem' }}>
                  {t('You are about to uninstall the app')}{' '}
                  <strong>{appToUninstall.package.name}</strong>.
                  <br /><br />
                  <strong>{t('Do you want to continue?')}</strong>
                </p>
              )
            }
            cancelButton={t('Cancel')}
            confirmButton={t('Uninstall')}
            onCancel={() => setAppToUninstall(null)}
            onConfirm={() => {
              uninstallApp({ appId: appToUninstall._id });
              setAppToUninstall(null);
            }}
          />
        </Segment>
      )}

    </Container>
  </>)
}
