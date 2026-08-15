/** The workspace's single API surface.
 *
 * `procurementApi` stays one flat object because every page imports it that way;
 * the calls themselves live in `endpoints/`, grouped like the backend routers
 * they talk to. Transport lives in `http.js` and demonstration mode in
 * `devMode.js`, so neither is repeated per call.
 */

import { analyticsEndpoints } from './endpoints/analytics'
import {
  communicationEndpoints,
  negotiatorActivityEndpoints,
  playbookImportEndpoints,
} from './endpoints/communication'
import {
  cardEndpoints,
  cardImportEndpoints,
  rfqEndpoints,
} from './endpoints/cards'
import {
  echemiEndpoints,
  sourcingEndpoints,
  webFormEndpoints,
} from './endpoints/sourcing'
import {
  escalationEndpoints,
  negotiationEndpoints,
  proposalEndpoints,
  supplierEndpoints,
} from './endpoints/suppliers'
import { settingsEndpoints } from './endpoints/settings'

export const procurementApi = {
  ...analyticsEndpoints,
  ...cardEndpoints,
  ...cardImportEndpoints,
  ...rfqEndpoints,
  ...echemiEndpoints,
  ...sourcingEndpoints,
  ...webFormEndpoints,
  ...supplierEndpoints,
  ...negotiationEndpoints,
  ...proposalEndpoints,
  ...escalationEndpoints,
  ...communicationEndpoints,
  ...negotiatorActivityEndpoints,
  ...playbookImportEndpoints,
  ...settingsEndpoints,
}
