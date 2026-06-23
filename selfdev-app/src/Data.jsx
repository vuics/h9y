import React, { useState, useEffect, useRef } from 'react'

import axios from 'axios'
import {
  Container,
  Loader,
  Message,
  Icon,
  Dropdown,
  Table,
  Menu,
  Button,
  Segment,
  Modal,
  // Header,
  // Checkbox,
  // Input,
  // Card,
  // Divider,
  // Tab,
  // Popup,
  // Accordion,
  // List,
  // Label,
  // Confirm,
  // Form,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'
import Form from '@rjsf/semantic-ui'
import validator from '@rjsf/validator-ajv8';
import { useXmppContext } from './components/XmppContext'

import Menubar from './components/Menubar'
import conf from './conf'

function humanFileSizeI18n(bytes, t, decimals = 1) {
  if (!bytes) return "0"
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const units = ["B", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

  return `${value} ${t(`units.${units[i]}`)}`;
}


const getContentIcon = (contentType = '') => {
  if (!contentType) return 'file';

  // Normalize
  const ct = contentType.toLowerCase();

  if (ct.includes('text/')) {
    return 'file text';
  } else if (ct.includes('audio/')) {
    return 'file audio';
  } else if (ct.includes('video/')) {
    return 'file video';
  } else if (ct.includes('image/')) {
    return 'file image';
  } else if (ct.includes('application/pdf')) {
    return 'file pdf';
  } else if (
    ct.includes('application/zip') ||
    ct.includes('application/x-7z-compressed') ||
    ct.includes('application/x-rar') ||
    ct.includes('application/x-rar-compressed') ||
    ct.includes('application/x-tar') ||
    ct.includes('application/gzip')
  ) {
    return 'file archive';
  } else if (
    ct.includes('application/json') ||
    ct.includes('application/xml') ||
    ct.includes('application/x-yaml')
  ) {
    return 'file code';
  } else if (
    ct.includes('application/vnd.ms-excel') ||
    ct.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  ) {
    return 'file excel';
  } else if (
    ct.includes('application/msword') ||
    ct.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ) {
    return 'file word';
  } else if (
    ct.includes('application/vnd.ms-powerpoint') ||
    ct.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')
  ) {
    return 'file powerpoint';
  }

  return 'file';
};

const openFile = (file) => {
  const url = `${conf.xmpp.shareUrlPrefix}${file.slot}/${file.filename}`;
  window.open(url, "_blank");
}

const editStorage = (storage, { storages, setStorages }) => {
  setStorages(storages.map(b =>
    b._id === storage._id ? { ...b, editing: true } : b
  ))
}

export default function Data ({
  hideMenubar = false, clickFile = openFile, clickStorage = editStorage
} = {}) {
  const { t } = useTranslation('Data')
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ files, setFiles ] = useState([])
  const [ attaching, setAttaching ] = useState(false)
  const [ storages, setStorages ] = useState([])
  const [ addingStorage, setAddingStorage ] = useState(false)
  const attachFileInputRef = useRef(null);
  const { xmppClient } = useXmppContext()

  const storageSchema = {
    title: t('Key-value'),
    description: t('Add key-value pair to the KV storage'),
    type: 'object',
    properties: {
      namespace: { type: 'string', title: t('Namespace'), default: 'default' },
      key:        { type: 'string', title: t('Key') },
      value:      { type: 'string', title: t('Value'), format: 'textarea' },
    }
  }

  const [ active, setActive ] = useState(() => {
    return localStorage.getItem('data.active') || 'files'
  })
  useEffect(() => {
    localStorage.setItem('data.active', active);
  }, [active]);

  const indexFiles = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/file?skip=${conf.data.skip}&limit=${conf.data.limit}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('res:', res)
      console.log('res.data:', res.data)
      setFiles(res.data)
    } catch (err) {
      console.error('get files error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting files.'))
    } finally {
      setLoading(false)
    }
  }

  const indexStorages = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/storage?skip=${conf.data.skip}&limit=${conf.data.limit}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('res:', res)
      console.log('res.data:', res.data)
      setStorages(res.data)
    } catch (err) {
      console.error('get storages error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting storages.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    indexFiles()
    indexStorages()
  }, [active])

  const deleteFile = async ({ file }) => {
    setLoading(true)
    try {
      const res = await axios.delete(`${conf.api.url}/file/${file._id}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('file doc delete res:', res)
      // setResponseMessage(`File deleted successfully`)
      setFiles(files.filter(obj => obj._id !== file._id))
    } catch (err) {
      console.error('delete file error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error deleting file.'))
    } finally {
      setLoading(false)
    }
  }

  const postStorage = async ({ storage } = {}) => {
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/storage`, {
        ...storage
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('res:', res)
      console.log('res.data:', res.data)
      setStorages([ ...storages, res.data ])
    } catch (err) {
      console.error('get storages error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting storages.'))
    } finally {
      setLoading(false)
    }
  }

  const putStorage = async ({ storage }) => {
    setLoading(true)
    try {
      console.log('putStorage storage:', storage)
      const res = await axios.put(`${conf.api.url}/storage/${storage._id}`, {
        ...storage,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('storage put res:', res)
      // setResponseMessage(`Storage updated successfully`)
      setStorages(storages.map(a => a._id === res.data._id ? res.data : a))
    } catch (err) {
      console.error('put storage error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error putting storage.'))
    } finally {
      setLoading(false)
    }
  }

  const deleteStorage = async ({ storage }) => {
    setLoading(true)
    try {
      const res = await axios.delete(`${conf.api.url}/storage/${storage._id}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('storage doc delete res:', res)
      // setResponseMessage(`Storage deleted successfully`)
      setStorages(storages.filter(obj => obj._id !== storage._id))
    } catch (err) {
      console.error('delete storage error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error deleting storage.'))
    } finally {
      setLoading(false)
    }
  }

  const attachFileInit = () => {
    // console.log('user:', user)
    attachFileInputRef.current.click(); // triggers hidden input
  };

  const onFileInputChange = async (event) => {
    try {
      setAttaching(true)
      const fileUrl = await attachFile(event)
      console.log('fileUrl:', fileUrl)
      await indexFiles()
    } catch (err) {
      console.error('Error attaching file:', err);
    } finally {
      setAttaching(false)
    }
  }


  const attachFile = async (event) => {
    return new Promise((resolve, reject) => {
      try {
        const file = event.target.files[0];
        if (!file) {
          throw new Error(`Error attaching file: ${file}`)
        }
        const reader = new FileReader();
        reader.onload = async () => {
          // console.log('Loaded file:', e.target.result)
          const getUrl = await xmppClient.uploadFile({
            buffer: reader.result,
            filename: file.name,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
            shareHost: conf.xmpp.shareHost,
          })
          resolve(getUrl)
        };
        reader.onerror = (err) => {
          throw err
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        reject(err);
      }
    })
  }

  console.log('storages:', storages)

  return (<>
    { !hideMenubar && (
      <Container fluid>
        <Menubar />
      </Container>
    )}

    <Container>
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
    </Container>

    <Container fluid
      style={{ padding: '15px 15px 0 15px' }}
    >
      <Menu pointing>
        <Menu.Item
          name={t('File System')}
          active={active === 'files'}
          onClick={() => setActive('files')}
        />
        <Menu.Item
          name={t('KV Storage')}
          active={active === 'storages'}
          onClick={() => setActive('storages')}
        />
      </Menu>


      { active === 'files' && (<>
        <Button size='large' onClick={() => { 
          attachFileInit()
        }}>
          <Icon.Group size='large'>
            <Icon name='upload' />
          </Icon.Group>
          {' '}
          {t('Upload File')}
          {' '}
          <input
            type="file"
            // accept="application/json"
            ref={attachFileInputRef}
            onChange={onFileInputChange}
            style={{ display: 'none' }} // hide input
          />
        </Button>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t('File Name')}</Table.HeaderCell>
              <Table.HeaderCell>{t('Size')}</Table.HeaderCell>
              <Table.HeaderCell>{t('Path')}</Table.HeaderCell>
              <Table.HeaderCell>{t('Created At')}</Table.HeaderCell>
              <Table.HeaderCell>{t('Actions')}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>

            { files.map(file => (
              <Table.Row key={file.slot}>
                <Table.Cell
                  onClick={() => clickFile(file)}
                >
                  <Icon name={getContentIcon(file.contentType)} />
                  {file.filename}
                </Table.Cell>
                <Table.Cell
                  collapsing
                  onClick={() => clickFile(file)}
                >
                  {humanFileSizeI18n(file.filesize, t)}
                </Table.Cell>
                <Table.Cell
                  collapsing
                  onClick={() => clickFile(file)}
                >
                  {file.path}
                </Table.Cell>
                <Table.Cell
                  collapsing
                  onClick={() => clickFile(file)}
                >
                  {(new Date(file.createdAt)).toLocaleTimeString()}
                </Table.Cell>
                <Table.Cell
                  collapsing
                >
                  <Dropdown icon='ellipsis vertical' color='gray'>
                    <Dropdown.Menu>
                      <Dropdown.Item
                        text={t('Open')}
                        onClick={() => {
                          openFile(file)
                        }}
                      />
                      <Dropdown.Divider />
                      <Dropdown.Item
                        text={t('Delete')}
                        onClick={() => {
                          deleteFile({ file })
                        }}
                      />
                    </Dropdown.Menu>
                  </Dropdown>
                </Table.Cell>
              </Table.Row>
            ))}

          </Table.Body>
        </Table>
      </>)}

      { active === 'storages' && (<>
        { !addingStorage && (<>
          <Button size='large' onClick={() => setAddingStorage(!addingStorage) }>
            <Icon.Group size='large'>
              <Icon name='hockey puck' />
              <Icon corner name='add' />
            </Icon.Group>
            {' '}
            {t('Add Key-value')}
            {' '}
          </Button>
        </>)}

        { addingStorage && (<>
          <Segment secondary>
            <Form
              schema={storageSchema}
              validator={validator}
              onSubmit={({ formData }) => {
                postStorage({ storage: formData });
                setAddingStorage(!addingStorage)
              }}
            >
              <Button.Group>
                <Button type='button' onClick={() => setAddingStorage(!addingStorage) }>
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
        </>)}

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t('Namespace')}</Table.HeaderCell>
              <Table.HeaderCell>{t('Key')}</Table.HeaderCell>
              <Table.HeaderCell>{t('Value')}</Table.HeaderCell>
              <Table.HeaderCell>{t('Updated At')}</Table.HeaderCell>
              <Table.HeaderCell>{t('Actions')}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>

            { storages.map(storage => (<>
              <Table.Row key={storage.key}>
                <Table.Cell
                  collapsing
                  onClick={() => clickStorage(storage, { storages, setStorages })}
                >
                  {storage.namespace}
                </Table.Cell>
                <Table.Cell
                  collapsing
                  onClick={() => clickStorage(storage, { storages, setStorages })}
                >
                  <Icon name='hockey puck' />
                  {storage.key}
                </Table.Cell>
                <Table.Cell
                  onClick={() => clickStorage(storage, { storages, setStorages })}
                >
                  {storage.value.length > 1000
                    ? (<> {storage.value.slice(0, 1000)} <Icon name='ellipsis horizontal' color='grey'/> </>)
                    : storage.value}
                </Table.Cell>
                <Table.Cell
                  collapsing
                  onClick={() => clickStorage(storage, { storages, setStorages })}
                >
                  {(new Date(storage.updatedAt)).toLocaleTimeString()}
                </Table.Cell>
                <Table.Cell
                  collapsing
                >
                  <Dropdown icon='ellipsis vertical' color='gray'>
                    <Dropdown.Menu>
                      <Dropdown.Item
                        text={t('Edit')}
                        onClick={() => {
                          editStorage(storage, { storages, setStorages })
                        }}
                      />
                      <Dropdown.Divider />
                      <Dropdown.Item
                        text={t('Delete')}
                        onClick={() => {
                          deleteStorage({ storage })
                        }}
                      />
                    </Dropdown.Menu>
                  </Dropdown>
                </Table.Cell>
              </Table.Row>

              { storage.editing && (
                <Modal
                  open={storage.editing}
                >
                  <Modal.Header>{t('Edit Key-value')}</Modal.Header>
                  <Modal.Content>
                    <Form
                      schema={storageSchema}
                      validator={validator}
                      formData={storage}
                      onSubmit={({ formData }) => {
                        putStorage({ storage: formData });
                      }}
                    >
                      <Button.Group>
                        <Button type='button' onClick={() => {
                          setStorages(storages.map(b =>
                            b._id === storage._id ? { ...storage, editing: false } : b
                          ))
                        }}>
                          <Icon name='cancel' />
                          {' '}
                          {t('Cancel')}
                          {' '}
                        </Button>
                        <Button.Or />
                        <Button type='submit' color='green' on>
                          <Icon name='save' />
                          {' '}
                          {t('Update')}
                          {' '}
                        </Button>
                      </Button.Group>
                    </Form>
                  </Modal.Content>
                </Modal>
              )}
            </>))}

          </Table.Body>
        </Table>
      </>)}

    </Container>
  </>)
}
