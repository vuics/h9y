import { Router } from 'express';
import { inspect } from 'util'
import axios from 'axios'
import kbnEsQuery from '@cybernetex/kbn-es-query'
const {
  fromKueryExpression,
  toElasticsearchQuery
} = kbnEsQuery

import { checkAuth } from '../middleware/check-auth.js';
import { Verbose, log, warn, error } from '../services.js';
import conf from '../conf.js'
import opensearch from '../opensearch.js'

const verbose = Verbose('sd:routes/logs'); verbose('');
const router = Router();


// Convert DQL/KQL string to Elasticsearch/OpenSearch DSL,
// and inject forced backend filters (userId, tenantId, workspaceId…)
export function convertDqlToDsl(dql, forcedFilters = {}) {
  const ast = fromKueryExpression(dql || '*');
  const userDsl = toElasticsearchQuery(ast);

  // Convert forced filters into DSL
  const forced = Object.entries(forcedFilters).map(([field, value]) => ({
    match: { [field]: value }
  }));

  return {
    bool: {
      must: [userDsl, ...forced]
    }
  };
}


export function buildLogQuery({
  dql,
  userId,
  skip = 0,
  limit = 100,
  start,
  end,
  sort = '@timestamp:desc'
}) {
  const [sortField, sortOrder = 'desc'] = sort.split(':');

  // Forced backend filters
  const forcedFilters = { userId };

  // Convert DQL → DSL + enforce backend filters
  const dsl = convertDqlToDsl(dql, forcedFilters);

  // Add time range
  if (start || end) {
    dsl.bool.must.push({
      range: {
        '@timestamp': {
          ...(start ? { gte: start } : {}),
          ...(end   ? { lte: end   } : {})
        }
      }
    });
  }

  return {
    index: 'logs',
    body: {
      from: Number(skip),
      size: Number(limit),
      sort: [{ [sortField]: sortOrder }],
      query: dsl,

      // Useful aggregations for a dashboard UI
      aggs: {
        levels:   { terms: { field: 'level.keyword',   size: 20 }},
        names: { terms: { field: 'name.keyword', size: 1000 }},
        per_minute: {
          date_histogram: {
            field: '@timestamp',
            interval: '1m'
          }
        }
      }
    }
  };
}


router.get('/', checkAuth, async (req, res, next) => {
  try {
    // verbose('dashboard body:', req.body);
    if (!opensearch) {
      throw new Error('OpenSearch is not connected')
    }

    const {
      q = '*',
      skip = 0,
      limit = 1000,
      start,
      end,
      sort = '@timestamp:desc'
    } = req.query;

    const userId = req.user?._id?.toString();

    const query = buildLogQuery({
      dql: q,
      userId,
      skip,
      limit,
      start,
      end,
      sort
    });

    const result = await opensearch.search(query);
    // verbose('response:', inspect(result, { depth: null, colors: true }))
    const logsData= result?.body?.hits?.hits?.map(h => h._source)
    const out = {
      result: 'ok',
      query,
      logsData,

      // FIXME: do we need it?
      hits: result.body.hits.hits,
      total: result.body.hits.total,
      aggs: result.body.aggregations
    };
    // verbose("logs out:", inspect(out, { depth: null, colors: true }))
    res.json(out);
  } catch (err) {
    error('Get logs error:', err)
    res.status(500).json({ result: 'error', message: err.toString() });
  }
})


// router.get('/metrics', checkAuth, async (req, res, next) => {
//   try {
//     const { query,
//       // start, end, step
//     } = req.query

//     const now = Math.floor(Date.now() / 1000);
//     const start = now - 60 * 60; // last 1 hour
//     const params = {
//       // query: 'agents_processed',
//       query,

//       start,
//       end: now,
//       step: "30s",
//       // start,
//       // end,
//       // step,
//     }
//     verbose('query:', query)
//     // http://localhost:9090/api/v1/query?query=agents_processed
//     const response = await axios.get("http://prometheus:9090/api/v1/query_range", {
//       params,
//     });
//     // verbose('response:', inspect(response, { depth: null, colors: true }))

//     const out = {
//       result: 'ok',
//       params,
//       metrics: response.data,
//     };
//     // verbose("logs out:", inspect(out, { depth: null, colors: true }))

//     res.json(out);
//   } catch (err) {
//     error('Get logs error:', err)
//     res.status(500).json({ result: 'error', message: err.toString() });
//   }
// })

export default router;
