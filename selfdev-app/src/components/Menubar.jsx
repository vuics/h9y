import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Menu,
  Icon,
  Dropdown,
  Image,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

import i18n from '../i18n'
import conf, { hasProfile } from '../conf.js'
import Logo from './Logo'
import { useIndexContext } from './IndexContext'

export default function Menubar ({ children }) {
  const { user } = useIndexContext()
  const { t } = useTranslation('Menubar')
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const name = `${user.firstName} ${user.lastName}`
  const [avatar, setAvatar] = useState(null);

  // console.log('avatar:', avatar)

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const res = await axios.get(`${conf.api.url}/profile/avatar`, {
          withCredentials: true,
        });
        if (res.data?.avatar) {
          setAvatar(res.data.avatar);
        }
      } catch (err) {
        console.error('Failed to load avatar', err);
      }
    };

    fetchAvatar();
  }, []);

  return (
    <Menu size='tiny'>
      <Menu.Item header onClick={() => window.location.assign(conf.web.url)} active={pathname==='/'}>
        <Logo size='milli' gray />
        {'\u00A0'}
        <span style={{color: 'grey'}}>
          {t('name', { ns: 'app' })}
        </span>
      </Menu.Item>
      { conf.dash.enable && (
        <Menu.Item onClick={() => navigate('/dash')} active={pathname==='/dash'}>
          <Icon name='tachometer alternate' />
          {t('Dash')}
        </Menu.Item>
      ) }
      { conf.hive.enable && (
        <Menu.Item onClick={() => navigate('/hive')} active={pathname==='/hive'}>
          <Icon name='cubes' />
          {t('Hive')}
        </Menu.Item>
      ) }
      { conf.chat.enable && (
        <Menu.Item onClick={() => navigate('/chat')} active={pathname==='/chat'}>
          <Icon name='chat' />
          {t('Chat')}
        </Menu.Item>
      ) }
      { conf.map.enable && (
        <Menu.Item onClick={() => navigate('/map')} active={pathname==='/map'}>
          <Icon name='sitemap' />
          {t('Map')}
        </Menu.Item>
      ) }
      { conf.omni.enable && (
        <Menu.Item onClick={() => navigate('/omni')} active={pathname==='/omni'}>
          <Icon name='futbol outline' />
          {t('Omni')}
        </Menu.Item>
      ) }
      { conf.data.enable && (
        <Menu.Item onClick={() => navigate('/data')} active={pathname==='/data'}>
          <Icon name='database' />
          {t('Data')}
        </Menu.Item>
      ) }
      { conf.o11y.enable && hasProfile(['all', 'h9y', 'logs', 'metrics']) && (
        <Menu.Item onClick={() => navigate('/o11y')} active={pathname==='/o11y'}>
          <Icon name='chart bar' />
          {t('O11y')}
        </Menu.Item>
      ) }
      { conf.apps.enable && (
        <Menu.Item onClick={() => navigate('/apps')} active={pathname==='/apps'}>
          <Icon name='cloud download' />
          {t('Apps')}
        </Menu.Item>
      ) }

      {children}

      <Menu.Menu position='right'>
        { conf.docs.enable && (
          <Menu.Item
            onClick={() => window.open(`${conf.docs.url}${conf.docs.i18n[i18n.language]}`, '_blank')}
          >
            <Icon.Group size='large'>
              <Icon name='book' />
              <Icon name='external alternate' corner color='grey' />
            </Icon.Group>
            {t('Docs')}
          </Menu.Item>
        ) }
        <Dropdown
          item
          trigger={
            <span>
              { avatar ? (
                <Image
                  avatar
                  // inline
                  src={avatar}
                  style={{ width: '1.2rem', height: '1.2rem' }}
                />
              ): (
                <Icon name='user' />
              )}
              <span style={{ marginLeft: '0.5rem' }}>
                {name}
              </span>
              { user.roles.includes('admin') && (
                <span style={{ marginLeft: '0.3rem' }}>
                  ({t('Admin')})
                </span>
              )}
            </span>
          }
        >
          <Dropdown.Menu>
            { conf.profile.enable && (
              <Dropdown.Item onClick={() => navigate('/profile')}>
                <Icon name='address card outline' />
                {t('Profile')}
              </Dropdown.Item>
            )}
            { conf.subscription.enable && (
              <Dropdown.Item onClick={() => window.location.assign(`${conf.web.url}/subscription`)}>
                <Icon name='handshake' />
                {t('Subscription')}
              </Dropdown.Item>
            )}
            { conf.subscribe.enable && (
              <Dropdown.Item onClick={() => window.location.assign(`${conf.web.url}/subscribe`)}>
                <Icon name='shopping cart' />
                {t('Subscription')}
              </Dropdown.Item>
            )}
            { conf.wallet.enable && (
              <Dropdown.Item onClick={() => navigate('/wallet')}>
                <Icon name='credit card outline' />
                {t('Wallet')}
              </Dropdown.Item>
            )}

            <Dropdown.Divider />

            { conf.vault.enable && (
            <Dropdown.Item onClick={() => navigate('/vault')}>
              <Icon name='shield alternate' />
              {t('Vault')}
            </Dropdown.Item>
            )}
            { conf.keys.enable && (
            <Dropdown.Item onClick={() => navigate('/keys')}>
              <Icon name='key' />
              {t('API Keys')}
            </Dropdown.Item>
            )}
            { conf.settings.enable && (
            <Dropdown.Item onClick={() => navigate('/settings')}>
              <Icon name='settings' />
              {t('Settings')}
            </Dropdown.Item>
            )}

            {/*/}
            { conf.admin.enable && user.roles.includes('admin') && (<>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => navigate('/admin')}>
                <Icon name='wrench' />
                {t('Admin')}
              </Dropdown.Item>
            </>)}
            {/*/}

            <Dropdown.Divider />

            <Dropdown.Item onClick={() => navigate('/logout')}>
              <Icon name='sign-out' />
              {t('Log Out')}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </Menu.Menu>
    </Menu>
  )
}
