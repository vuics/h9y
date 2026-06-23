import React, { useState, useEffect } from 'react'
import {
  Container,
  Divider,
  Segment,
  Loader,
  Message,
  Header,
  Sidebar,
  Menu,
  Icon,
  Button,
} from 'semantic-ui-react'
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import { QCMarkdown } from './Text'
import { useIndexContext } from './IndexContext'
import { CountrySelector } from './Countries'
import { LanguageSelector } from '../i18n'
import Footer from './Footer'
import conf from '../conf'

export const loadLegal = async ({ docType, lang, country, t }) => {
  const normalizedLang = lang.split('-')[0].toLowerCase();
  const normalizedCountry = country.toUpperCase();

  const key = `${normalizedLang}-${normalizedCountry}`;
  const url = `/${conf.legal.dir}/${docType}/${key}.md`;

  const defaultKey = `${normalizedLang}_default`;
  const defaultUrl = `/${conf.legal.dir}/${docType}/${defaultKey}.md`;

  const fallbackKey = conf.legal.fallbackKey
  const fallbackUrl = `/${conf.legal.dir}/${docType}/${fallbackKey}.md`;

  console.log('url:', url);
  console.log('defaultUrl:', defaultUrl);
  console.log('fallbackUrl:', fallbackUrl);

  try {
    const res = await axios.get(url, {
      headers: { 'Accept': 'text/plain', },
    });
    return res.data;
  } catch (e) {
    console.warn(`Failed to load primary markdown: ${url}`, e);
  }

  try {
    const res = await axios.get(defaultUrl, {
      headers: { 'Accept': 'text/plain', },
    });
    return res.data;
  } catch (e) {
    console.warn(`Failed to load default markdown: ${defaultUrl}`, e);
  }

  try {
    const res = await axios.get(fallbackUrl, {
      headers: { 'Accept': 'text/plain', },
    });
    return res.data;
  } catch (e) {
    console.warn(`Failed to load fallback markdown: ${fallbackUrl}`, e);
  }

  return t('errorNotFound');
};

export default function Legal ({ docType }) {
  const { t, i18n } = useTranslation('Legal');
  const { country } = useIndexContext()
  const [ legal, setLegal ] = useState(null);
  const [ loading, setLoading ] = useState(true);
  const [ visible, setVisible ] = useState(false)

  console.log('legal:', legal)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const lang = i18n.language || 'en';
      const legal = await loadLegal({ docType, lang, country, t });
      setLegal(legal);
      setLoading(false)
    };

    load();
  }, [i18n.language, country]);

  return (<>
    <Sidebar.Pushable
      as={Segment.Group}
      // as={Segment}
      // style={{ overflow: 'hidden' }}
      // raised
    >
      <Sidebar
        as={Menu}
        animation='overlay'
        // animation='push'
        // animation='scale down'
        // animation='slide along'
        direction='left'
        // icon='labeled'
        inverted
        onHide={() => setVisible(false)}
        vertical
        visible={visible}
        // width='thin'
        width='wide'
      >
        <Menu.Item header
          onClick={() => setVisible(false)}
          as='h3'
        >
          {/*
          <Icon name='list' />
          */}
          {t('Legal Documents')}
        </Menu.Item>

        <Menu.Item />

        <Menu.Item link as='a' href='/terms'>
          <Icon name='file alternate outline' />
          {t('Terms of Service')}
        </Menu.Item>
        <Menu.Item link as='a' href='/privacy'>
          <Icon name='shield alternate' />
          {t('Privacy Policy')}
        </Menu.Item>
        <Menu.Item link as='a' href='/cookies'>
          <Icon name='privacy' />
          {t('Cookie Policy')}
        </Menu.Item>
        <Menu.Item link as='a' href='/disclaimer'>
          <Icon name='exclamation triangle' />
          {t('Disclaimer')}
        </Menu.Item>
        <Menu.Item link as='a' href='/acceptable'>
          <Icon name='ban' />
          {t('Acceptable Use Policy')}
        </Menu.Item>

        <Menu.Item />

        <Menu.Item onClick={() => setVisible(false)}>
          <Icon name='close' />
          {t('Close Sidebar')}
        </Menu.Item>
      </Sidebar>

      <Sidebar.Pusher>
        <Container>
          <Segment secondary>
            <Header as='h3'>
              {t('Legal Center')}
            </Header>
            {/*
            <Button
              icon
              labelPosition='left'
              as='a'
              href='/'
            >
              <Icon name='home' />
              {' '}
              Home
            </Button>
            {' '}
            */}
            <Button
              icon
              labelPosition='left'
              onClick={() => setVisible(!visible)}
              aria-expanded={visible}
              aria-controls="legal-sidebar"
            >
              <Icon name={visible ? 'close' : 'sidebar'} />
              {' '}
              {visible ? t('Hide Documents') : t('Browse Documents')}
            </Button>
            {' '}
            <LanguageSelector />
            {' '}
            <CountrySelector />

            { conf.legal.noteKey && (
              <Message info>
                <Message.Header>
                  {t('noteHeader')}
                </Message.Header>
                <p>
                  {t(conf.legal.noteKey)}
                </p>
              </Message>
            )}
          </Segment>

          <Segment>
            { loading ? (
              <Loader active inline="centered" content={t("loading")} />
            ) : (
              <QCMarkdown dark>
                {legal || t("loadingLegal")}
              </QCMarkdown>
            )}
          </Segment>
        </Container>
      </Sidebar.Pusher>
    </Sidebar.Pushable>
    <Footer />
  </>);
};
