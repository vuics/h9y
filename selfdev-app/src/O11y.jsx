import React, { useState, useEffect, useMemo } from 'react'
import ReactECharts from "echarts-for-react";

import axios from 'axios'
import {
  Container,
  Loader,
  Message,
  Input,
  Button,
  Icon,
  Segment,
  Menu,
  Card,
  Dropdown,
  Modal,
  Checkbox,
  Divider,
  // Tab,
  // Header,
  // Popup,
  // Accordion,
  // List,
  // Label,
  // Confirm,
  // Form,
  // Table,
} from 'semantic-ui-react'
import { texturePattern } from './components/patterns'
import { useTranslation } from 'react-i18next'
import Form from '@rjsf/semantic-ui'
import validator from '@rjsf/validator-ajv8';
import { JsonEditor } from "json-edit-react"
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react'
import { themeQuartz } from "ag-grid-community"

import {
  ChartsProvider,
  generateChartsTheme,
  getTheme,
  SnackbarProvider,
} from "@perses-dev/components";
import {
  DataQueriesProvider,
  dynamicImportPluginLoader,
  PluginRegistry,
  TimeRangeProvider,
} from "@perses-dev/plugin-system";
import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DatasourceStoreProvider,
  Panel,
  VariableProvider,
} from "@perses-dev/dashboards";
import * as prometheusPlugin from "@perses-dev/prometheus-plugin";
import * as timeseriesChartPlugin from "@perses-dev/timeseries-chart-plugin";

import { useWindowDimensions } from './helper.js'
import Menubar from './components/Menubar'
import { useIndexContext } from './components/IndexContext'
import conf, { bool, hasProfile } from './conf'

ModuleRegistry.registerModules([AllCommunityModule])


const prometheusDatasource = {
  kind: "GlobalDatasource",
  metadata: { name: "hello" },
  spec: {
    default: true,
    plugin: {
      kind: "PrometheusDatasource",
      spec: {
        directUrl: `${conf.api.url}/prometheus`,

        // NOTE: Another option is to query Prometheus directly
        // directUrl: "http://prometheus.dev.local:9090",

        // NOTE: We use Proxy but the section below is useless.
        //       It is easier to use the directUrl option.
        //
        // proxy: {
        //   kind: "HTTPProxy",
        //   spec: {
        //     url: `${conf.api.url}/prometheus`,
        //     allowedEndpoints: [
        //       { endpointPattern: "/api/v1/labels", method: "POST" },
        //       { endpointPattern: "/api/v1/series", method: "POST" },
        //       { endpointPattern: "/api/v1/metadata", method: "GET" },
        //       { endpointPattern: "/api/v1/query", method: "POST" },
        //       { endpointPattern: "/api/v1/query_range",  method: "POST" },
        //       { endpointPattern: "/api/v1/label/([a-zA-Z0-9_-]+)/values", method: "GET" },
        //       { endpointPattern: "/api/v1/parse_query", method: "POST" },
        //     ],
        //     // secret: "prometheus_secret_config"
        //   },
        // },
      },
    },
  },
};

class DatasourceApiImpl {
  getDatasource() {
    return Promise.resolve(undefined);
  }

  getGlobalDatasource() {
    return Promise.resolve(prometheusDatasource);
  }

  listDatasources() {
    return Promise.resolve([]);
  }

  listGlobalDatasources() {
    return Promise.resolve([prometheusDatasource]);
  }

  buildProxyUrl() {
    // NOTE: It is not used in the case of directUrl
    return `${conf.api.url}/prometheus`
  }
}
export const prometheusDatasourceApi = new DatasourceApiImpl();
export const prometheusDashboard = {
  kind: "Dashboard",
  metadata: {},
  spec: {},
};

export function LogsHistogram({ buckets }) {
  const { t } = useTranslation('O11y')
  const data = useMemo(() => {
    if (!buckets) return [];
    return buckets.map(b => ({
      time: new Date(b.key).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      count: b.doc_count
    }));
  }, [buckets]);

  const option = {
    tooltip: {
      trigger: "axis"
    },
    grid: {
      left: 50,
      right: 10,
      top: 30,
      bottom: 80,
    },
    xAxis: {
      type: "category",
      data: data.map(d => d.time),
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: "value",
      name: t("Logs per Minute"),
    },
    dataZoom: [
      { type: "inside" },
      { type: "slider" }
    ],
    series: [
      {
        name: "Logs",
        data: data.map(d => d.count),
        type: "bar",
        barWidth: "60%"
      }
    ]
  };

  return (
    <Card fluid>
      <Card.Content>
        <ReactECharts option={option} style={{ height: 300 }} />
      </Card.Content>
    </Card>
  );
}

/**
 * Secure PromQL injector for metrics prefixed with "h9y_".
 * - Adds userId if missing
 * - Replaces userId if present
 */
function injectUserId(promql, userId) {
  return promql.replace(
    /\b(h9y_[a-zA-Z0-9_]+)\b(\{[^}]*\})?(\[[^\]]+])?/g,
    (match, metric, labels, range) => {
      // If no labels, add userId
      if (!labels) {
        return `${metric}{userId="${userId}"}${range || ''}`;
      }

      // If labels exist, replace any existing userId
      if (/userId\s*=/.test(labels)) {
        const newLabels = labels.replace(/userId\s*=\s*"[^"]*"/, `userId="${userId}"`);
        return `${metric}${newLabels}${range || ''}`;
      }

      // Labels exist but no userId — append
      const newLabels = labels.replace(/\}$/, `,userId="${userId}"}`);
      return `${metric}${newLabels}${range || ''}`;
    }
  );
}

export default function O11y () {
  const { t } = useTranslation('O11y')
  const { user } = useIndexContext()
  const { height, width } = useWindowDimensions();
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ querying, setQuerying ] = useState(false)
  const [ selectedLog, setSelectedLog ] = useState(null)
  const [ modalOpen, setModalOpen ] = useState(false)

  const [ levelFilter, setLevelFilter ] = useState(() => {
    return localStorage.getItem('logs.levelFilter') || ''
  })
  useEffect(() => {
    localStorage.setItem('logs.levelFilter', levelFilter);
  }, [levelFilter]);

  const [ nameFilter, setNameFilter ] = useState(() => {
    return localStorage.getItem('logs.nameFilter') || ''
  })
  useEffect(() => {
    localStorage.setItem('logs.nameFilter', nameFilter);
  }, [nameFilter]);

  const [ logsQuery, setLogsQuery ] = useState(() => {
    return localStorage.getItem('logs.logsQuery') || '*'
  })
  useEffect(() => {
    localStorage.setItem('logs.logsQuery', logsQuery);
  }, [logsQuery]);

  const [ editing, setEditing ] = useState(() => {
    const saved = localStorage.getItem('logs.editing')
    return saved !== null ? bool(saved) : false
  })
  useEffect(() => {
    localStorage.setItem('logs.editing', editing.toString());
  }, [editing]);

  const [ active, setActive ] = useState(() => {
    return localStorage.getItem('logs.active') || 'logs'
  })
  useEffect(() => {
    localStorage.setItem('logs.active', active);
  }, [active]);

  const [ showLogsChart, setShowLogsChart ] = useState(() => {
    const saved = localStorage.getItem('logs.showLogsChart')
    return saved !== null ? bool(saved) : true
  })
  useEffect(() => {
    localStorage.setItem('logs.showLogsChart', showLogsChart.toString());
  }, [showLogsChart]);


  function toLocalDatetime(date) {
    const pad = (n) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const [ start, setStart ] = useState(toLocalDatetime(new Date(Date.now() - 24*60*60*1000))); // 24h ago
  const [ end, setEnd ] = useState(toLocalDatetime(new Date())); // now

  function formatLocalTimestamp(utcString) {
    const date = new Date(utcString);
    // Example: "2025-11-17 14:59"
    return date.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
  const [pastDuration, setPastDuration] = useState(() => {
    return localStorage.getItem('logs.pastDuration') || '1d'
  })
  useEffect(() => {
    localStorage.setItem('logs.pastDuration', pastDuration);
  }, [pastDuration]);


  const pastDurationOptions = [
    { key: "15m", text: t("Last 15 minutes"), value: "15m", seconds: 15 * 60 },
    { key: "30m", text: t("Last 30 minutes"), value: "30m", seconds: 30 * 60 },
    { key: "1h",  text: t("Last 1 hour"),     value: "1h",  seconds: 1 * 60 * 60 },
    { key: "3h",  text: t("Last 3 hours"),    value: "3h",  seconds: 3 * 60 * 60 },
    { key: "12h", text: t("Last 12 hours"),   value: "12h", seconds: 12 * 60 * 60 },
    { key: "1d",  text: t("Last 1 day"),      value: "1d",  seconds: 24 * 60 * 60 },
    { key: "3d",  text: t("Last 3 days"),     value: "3d",  seconds: 3 * 24 * 60 * 60 },
    { key: "7d",  text: t("Last 7 days"),     value: "7d",  seconds: 7 * 24 * 60 * 60 },
    { key: "custom", text: t("Custom"),       value: "custom", seconds: null },
  ];
  useEffect(() => {
    if (!pastDuration || pastDuration === "custom") return;
    const item = pastDurationOptions.find(x => x.value === pastDuration);
    if (!item || !item.seconds) return;
    const now = new Date();
    const ms = item.seconds * 1000;
    setEnd(toLocalDatetime(now));
    setStart(toLocalDatetime(new Date(now - ms)));
  }, [pastDuration]);

  // console.log('start:', start)
  // console.log('end:', end)
  // console.log('selectedLog:', selectedLog)

  const metricsQueriesSchema = {
    type: 'array',
    title: t('Queries'),
    items: {
      type: 'string',
      title: t('PromQL Query'),
    },
  }
  const [ metricsQueries, setMetricsQueries ] = useState(() => {
    return (localStorage.getItem('logs.metricsQueries') || 'h9y_messages_received_total\nh9y_messages_sent_total').split('\n')
  })
  useEffect(() => {
    localStorage.setItem('logs.metricsQueries', metricsQueries.join('\n'));
  }, [metricsQueries]);
  // console.log('Sequre queries:', metricsQueries.map(mq => injectUserId(mq, user._id)))

  // For AgGridReact
  const [logsColumns, ] = useState([
    { field: "@timestamp",
      headerName: t("Timestamp"),
      valueFormatter: (params) => formatLocalTimestamp(params.value),
    },
    { field: "level", headerName: t("Level") },
    { field: "name", headerName: t("Name") },
    { field: "message", headerName: t("Message") },
    { field: "archetype", headerName: t("Archetype") },
    { field: "connector", headerName: t("Connector") },
    { field: "agentId", headerName: t("Agent ID") },
    { field: "bridgeId", headerName: t("Bridge ID") },
  ]);

  const [ logsData, setLogsData ] = useState([ ]);
  const [ aggs, setAggs ] = useState(null);

  const [ timeRange, setTimeRange ] = useState({
    start: pastDuration === "custom" ? start : undefined,
    end: pastDuration === "custom" ? end : undefined,
    pastDuration: pastDuration === "custom" ? undefined : pastDuration,
  });
  useEffect(() => {
    if (!pastDuration) { return; }
    if (pastDuration === "custom") {
      setTimeRange({
        start,
        end,
      })
    } else {
      setTimeRange({ pastDuration })
    }
  }, [pastDuration, setTimeRange, start, end]);


  const refreshIntervalOptions = [
    { key: "0s",  text: t("No refresh"),       value: "0s",  seconds: 0 },
    { key: "30s", text: t("Every 30 seconds"), value: "30s", seconds: 30 },
    { key: "1m",  text: t("Every 1 minute"),   value: "1m",  seconds: 1 * 60 },
    { key: "2m",  text: t("Every 2 minutes"),  value: "2m",  seconds: 2 * 60 },
    { key: "5m",  text: t("Every 5 minutes"),  value: "5m",  seconds: 5 * 60 },
    { key: "10m", text: t("Every 10 minutes"), value: "10m", seconds: 10 * 60 },
    { key: "15m", text: t("Every 15 minutes"), value: "15m", seconds: 15 * 60 },
    { key: "30m", text: t("Every 30 minutes"), value: "30m", seconds: 30 * 60 },
    { key: "1h",  text: t("Every 1 hour"),     value: "1h",  seconds: 60 * 60 },
  ];
  const [refreshInterval, setRefreshInterval] = useState(() => {
    return localStorage.getItem('logs.refreshInterval') || '0s'
  })
  useEffect(() => {
    localStorage.setItem('logs.refreshInterval', refreshInterval);
  }, [refreshInterval]);

  useEffect(() => {
    if (active !== 'logs') {
      return
    }
    // Always fetch once on interval change
    fetchLogs();

    const intervalSeconds =
      refreshIntervalOptions.find(o => o.value === refreshInterval)?.seconds ?? 0;
    if (intervalSeconds === 0) return; // no auto-refresh

    const id = setInterval(() => {
      fetchLogs();
    }, intervalSeconds * 1000);

    return () => clearInterval(id); // cleanup on change/unmount
  }, [refreshInterval, active]);


  const muiTheme = getTheme("light");
  const chartsTheme = generateChartsTheme(muiTheme, {});
  const pluginLoader = dynamicImportPluginLoader([
    {
      resource: prometheusPlugin.getPluginModule(),
      importPlugin: () => Promise.resolve(prometheusPlugin),
    },
    {
      resource: timeseriesChartPlugin.getPluginModule(),
      importPlugin: () => Promise.resolve(timeseriesChartPlugin),
    },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 0,
      },
    },
  });


  const fetchLogs = async () => {
    if (!hasProfile(['all', 'h9y', 'logs'])) {
      return;
    }
    // setLoading(true)
    setQuerying(true)
    try {
      const res = await axios.get(`${conf.api.url}/logs?skip=${conf.o11y.skip}&limit=${conf.o11y.limit}&q=${logsQuery}&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('res:', res)
      if (res.status === 304) {
        console.log("Not Modified — use cached data");
      } else {
        console.log("Got new data> res.data", res.data);
        setLogsData(res.data.logs)
        setAggs(res.data.aggs)
      }
    } catch (err) {
      console.error('fetch logs error:', err);
      return setResponseError(err?.response?.data?.message || t('Error fetching logs.'))
    } finally {
      // setLoading(false)
      setQuerying(false)
    }
  }

  const theme = themeQuartz.withParams({
    spacing: 3,
  });

  const TimeInterval = () => {
    return (<>
      <Dropdown
        placeholder={t("Past duration")}
        selection
        options={pastDurationOptions}
        value={pastDuration}
        onChange={(e, { value }) => setPastDuration(value)}
      />
      {' '}
      <Icon name='calendar alternate outline' color='grey' />
      <Input
        type="datetime-local"
        label={t("Start")}
        value={start || ""}
        onChange={(e) => { setStart(e.target.value); setPastDuration('custom') }}
        style={{ marginRight: "10px" }}
      />
      <Input
        type="datetime-local"
        label={t("End")}
        value={end || ""}
        onChange={(e) => { setEnd(e.target.value); setPastDuration('custom') }}
        style={{ marginRight: "10px" }}
      />
      <Dropdown
        placeholder={t("Refresh Interval")}
        selection
        options={refreshIntervalOptions}
        value={refreshInterval}
        onChange={(e, { value }) => setRefreshInterval(value)}
      />
    </>)
  }

  return (<>
    <Container fluid>
      <Menubar>
        <Menu.Item style={{
          padding: '0 0.7rem 0 0',
          backgroundImage: texturePattern,
        }}/>
        <Menu.Header style={{
          paddingLeft: '0.5rem',
          paddingRight: '0.5rem',
        }}>
          <Menu pointing secondary compact>
            { hasProfile(['all', 'h9y', 'logs']) && (
              <Menu.Item
                active={active === 'logs'}
                onClick={() => { setActive('logs') }}
              >
                <Icon name='th list' color={active === 'logs' ? conf.style.color0 : 'grey'}/>
                {' '}
                {t('Logs')}
                {' '}
              </Menu.Item>
            )}

            { hasProfile(['all', 'h9y', 'metrics']) && (
              <Menu.Item
                active={active === 'metrics'}
                onClick={() => { setActive('metrics') }}
              >
                {' '}
                {t('Metrics')}
                {' '}
              </Menu.Item>
            )}

            { hasProfile(['all', 'h9y', 'logs', 'metrics']) && (
              <Menu.Item
                position='right'
                onClick={() => { setEditing(!editing) }}
              >
                <Icon name={editing ? 'toggle on' : 'toggle off'} color={editing ? conf.style.color0 : 'grey'}/>
                {' '}
                {t('Edit Queries')}
                {' '}
              </Menu.Item>
            )}
          </Menu>
        </Menu.Header>
      </Menubar>
    </Container>

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

    <Container fluid style={{ padding: '15px 15px 0 15px' }}>
      { editing && active === 'logs' && hasProfile(['all', 'h9y', 'logs']) && (<>
        <Segment secondary size='mini'>
          <Input
            loading={querying}
            iconPosition='left'
            type='text'
            placeholder={t('Query...')}
            action
            fluid
            value={logsQuery}
            onChange={e => setLogsQuery(e.target.value)}
          >
            <Icon name='terminal' />
            <input
              style={{
                fontFamily: `"Fira Code", "JetBrains Mono", "Source Code Pro", monospace`,
                fontSize: "14px",
                letterSpacing: "0.3px",
              }}
            />
            <Button
              icon
              labelPosition='right'
              color={conf.style.color0}
              onClick={fetchLogs}
            >
              {t('Query')}
              <Icon name='search' />
            </Button>
          </Input>

          <div style={{ marginTop: '0.5rem', alignItems: 'center' }}>
            {' '}
            <Icon name='filter' color='grey'/>
            <Dropdown
              placeholder={t("Level")}
              selection
              clearable
              options={aggs?.levels?.buckets?.map(l => ({ key: l.key, text: l.key, value: l.key })) || []}
              value={levelFilter}
              onChange={(e, { value }) => {
                let q = logsQuery
                q = q.replace(` AND level:${levelFilter}`, '')
                if (value) q += ` AND level:${value}`;
                setLevelFilter(value)
                setLogsQuery(q)
              }}
            />

            {' '}
            <Dropdown
              placeholder={t("Name")}
              selection
              clearable
              options={aggs?.names?.buckets?.map(s => ({ key: s.key, text: s.key, value: s.key })) || []}
              value={nameFilter}
              onChange={(e, { value }) => {
                let q = logsQuery
                q = q.replace(` AND name:${nameFilter}`, '')
                if (value) q += ` AND name:${value}`;
                setNameFilter(value)
                setLogsQuery(q)
              }}
            />

            {' '}
            <TimeInterval />

            {' '}
            <Checkbox
              label={t('Show Logs Chart')}
              onChange={(e, data) => setShowLogsChart(data.checked)}
              checked={showLogsChart}
            />
          </div>
        </Segment>
      </>)}

      { editing && active === 'metrics' && hasProfile(['all', 'h9y', 'metrics']) && (
        <Segment secondary size='mini'>
          <Form
            schema={metricsQueriesSchema}
            validator={validator}
            formData={metricsQueries}
            onSubmit={({ formData }) => { setMetricsQueries(formData); setEditing(!editing) }}
          >
            <Button.Group>
              <Button type='button' onClick={() => { setMetricsQueries(metricsQueries); setEditing(!editing) }}>
                <Icon name='cancel' />
                {' '}
                {t('Cancel')}
                {' '}
              </Button>
              <Button.Or />
              <Button type='submit' positive on>
                <Icon name='save' />
                {' '}
                {t('Apply')}
                {' '}
              </Button>
            </Button.Group>
          </Form>

          <Divider />
          <TimeInterval />

          {' '}

          <Button
            icon
            compact
            labelPosition='right'
            color={conf.style.color0}
            onClick={() => {
              // FIXME: This is a way to re-render Perses components.
              //        I do not see any better way now.
              setActive('logs'); setTimeout(() => setActive('metrics'), 10)
            }}
          >
            {t('Query')}
            <Icon name='search' />
          </Button>

        </Segment>
      )}

      { active === 'logs' && (
        <div style={{
          width: width - 25,
          height: height - conf.iframe.topOffset - conf.iframe.bottomOffset - 25
                 - (showLogsChart ? 340 : 0)
                 - (editing ? 110 : 0)
        }}>
          { showLogsChart && aggs && (
            <LogsHistogram buckets={aggs.per_minute.buckets} />
          )}

          <AgGridReact
            rowData={logsData}
            columnDefs={logsColumns}
            theme={theme}
            pagination
            paginationPageSize={1000}
            paginationPageSizeSelector={[200, 500, 1000]}
            cacheBlockSize={500}
            onRowClicked={(e) => { setSelectedLog(e.data); setModalOpen(true); }}
          />

          <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <Modal.Header>{t('Log Detail')}</Modal.Header>
            <Modal.Content>
              <JsonEditor
                data={selectedLog || {}}
                viewOnly
                rootName=''
              />
            </Modal.Content>
          </Modal>

        </div>
      )}

      { active === 'metrics' && (
        <div
          style={{
            width: width - 25,
            height: height - conf.iframe.topOffset - conf.iframe.bottomOffset - 75
          }}
        >

          <ThemeProvider theme={muiTheme}>
            <ChartsProvider chartsTheme={chartsTheme}>
              <SnackbarProvider
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                variant="default"
                content=""
              >
                <PluginRegistry
                  pluginLoader={pluginLoader}
                  defaultPluginKinds={{
                    Panel: "TimeSeriesChart",
                    TimeSeriesQuery: "PrometheusTimeSeriesQuery",
                  }}
                >
                  <QueryClientProvider client={queryClient}>
                    <TimeRangeProvider timeRange={timeRange} refreshInterval={refreshInterval} setTimeRange={setTimeRange} setRefreshInterval={setRefreshInterval}>
                      <VariableProvider>
                        <DatasourceStoreProvider
                          dashboardResource={prometheusDashboard}
                          datasourceApi={prometheusDatasourceApi}
                        >
                          <DataQueriesProvider
                            definitions={metricsQueries.map(mq => ({
                              kind: "PrometheusTimeSeriesQuery",
                              spec: { query: injectUserId(mq, user._id) },
                            }))}
                          >
                            <Panel
                              panelOptions={{
                                hideHeader: true,
                              }}
                              definition={{
                                kind: "Panel",
                                spec: {
                                  display: { name: "Example Panel" },
                                  plugin: {
                                    kind: "TimeSeriesChart",
                                    spec: {
                                      legend: {
                                        position: "bottom",
                                        size: "medium",
                                      },
                                    },
                                  },
                                },
                              }}
                            />
                          </DataQueriesProvider>
                        </DatasourceStoreProvider>
                      </VariableProvider>
                    </TimeRangeProvider>
                  </QueryClientProvider>
                </PluginRegistry>
              </SnackbarProvider>
            </ChartsProvider>
          </ThemeProvider>

        </div>
      )}

    </Container>
  </>)
}
