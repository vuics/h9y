import React, { useState, useEffect } from 'react'
import ReactECharts from "echarts-for-react";
import axios from 'axios'
import {
  Container,
  Segment,
  Loader,
  Message,
  Header,
  Statistic,
  Icon,
  // Input,
  // Button,
  // List,
  // Label,
  // Confirm,
  // Checkbox,
  // Form,
  // Table,
  // Popup,
  // Dropdown,
  // Divider,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import Menubar from './components/Menubar'
import conf from './conf'
// import { sleep } from './helper'


const buildHorizontalBarOptions = ({ title, data, t }) => {
  const categories = data.map(item => item._id);
  const totals = data.map(item => item.total);
  const deployed = data.map(item => item.deployed);
  return {
    title: { text: title, left: 'center' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { 
      bottom: 0,
      data: [t('total'), t('deployed')],
    },
    grid: { left: 160, right: 50, top: 60, bottom: 60 },
    xAxis: { type: 'value', min: 0, max: Math.max(...totals) },
    yAxis: { 
      type: 'category', 
      data: categories,
      axisLabel: {
        padding: [0, 24, 0, 0],
        margin: 8
      }
    },
    series: [
      {
        name: t('total'),
        type: 'bar',
        data: totals,
        barWidth: 26,
        label: { show: true, position: 'insideRight', formatter: '{c}' },
        emphasis: { focus: 'series' },
        z: 1
      },
      {
        name: t('deployed'),
        type: 'bar',
        data: deployed,
        barWidth: 26,
        barGap: '-100%',
        label: { show: true, position: 'insideRight', formatter: '{c}' },
        emphasis: { focus: 'series' },
        z: 2
      }
    ]
  };
};

export default function Dash () {
  const { t } = useTranslation('Dash')
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ dashboard, setDashboard ] = useState({})

  const getDash = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/dashboard`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      setDashboard(res.data)
    } catch (err) {
      console.error('get dash error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting dash.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getDash()
  }, [])

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

      <Header as='h1' textAlign='center'>
        {t('Dashboard')}
      </Header>

      <Segment secondary>
        <div
          style={{
            marginTop: '2vh',
            marginBottom: '2vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Statistic.Group>

            <Statistic color='teal' size='huge'>
              <Statistic.Value>
                {dashboard.maps}
              </Statistic.Value>
              <Statistic.Label>
                <Icon name='map' />
                {t('Maps')}
              </Statistic.Label>
            </Statistic>

            <Statistic color='violet' size='huge'>
              <Statistic.Value>
                {dashboard.files}
              </Statistic.Value>
              <Statistic.Label>
                <Icon name='cloud download' />
                {t('Files')}
              </Statistic.Label>
            </Statistic>

            <Statistic color='purple' size='huge'>
              <Statistic.Value>
                {dashboard.storages}
              </Statistic.Value>
              <Statistic.Label>
                <Icon name='cloud download' />
                {t('KV Storages')}
              </Statistic.Label>
            </Statistic>

            <Statistic color='pink' size='huge'>
              <Statistic.Value>
                {dashboard.apps}
              </Statistic.Value>
              <Statistic.Label>
                <Icon name='cloud download' />
                {t('Apps')}
              </Statistic.Label>
            </Statistic>

          </Statistic.Group>
          <br/>
        </div>
      </Segment>

      <Segment secondary>
        <div
          style={{
            marginTop: '2vh',
            marginBottom: '2vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Statistic.Group>

            <Statistic color='green' size='huge'>
              <Statistic.Value>
                {dashboard.deployedAgents}/{dashboard.agents}
              </Statistic.Value>
              <Statistic.Label>
                <Icon name='user secret' />
                {t('Deployed Agents')}
              </Statistic.Label>
            </Statistic>

            <Statistic color='blue' size='huge'>
              <Statistic.Value>
                {dashboard.deployedBridges}/{dashboard.bridges}
              </Statistic.Value>
              <Statistic.Label>
                <Icon name='linkify' />
                {t('Deployed Bridges')}
              </Statistic.Label>
            </Statistic>

          </Statistic.Group>
        </div>
      </Segment>

      <Segment style={{ height: '850px' }} secondary>
        { dashboard && dashboard.agentArchetypes && (<>
          <ReactECharts
            key="archetypes-echarts"
            option={buildHorizontalBarOptions({
              title: t('Agent Archetypes'),
              data: dashboard.agentArchetypes,
              t,
            })}
            style={{ height: "800px", width: "100%" }}
          />
        </>)}
      </Segment>

      <Segment style={{ height: '550px' }} secondary>
        { dashboard && dashboard.bridgeConnectors && (<>
          <ReactECharts
            key="connectors-echarts"
            option={buildHorizontalBarOptions({
              title: t('Bridge Connectors'),
              data: dashboard.bridgeConnectors,
              t,
            })}
            style={{ height: "500px", width: "100%" }}
          />
        </>)}
      </Segment>

      <br />
    </Container>
  </>)
}
