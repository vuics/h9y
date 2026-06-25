import NodeVault from 'node-vault'

import { Verbose, log, warn, error } from './services.js'
import conf from './conf.js'
import Secret from './models/secret.js'

const verbose = Verbose('sd:vault'); verbose('')

export let vaultClient = null

async function unsealVault() {
  try {
    let status = await vaultClient.status();
    log(`Vault status (before)> sealed: ${status.sealed}`);
    if (!status.sealed) {
      return log('Vault was already unsealed!');
    }

    let key, result
    for (let key of conf.vault.unsealKeys) {
      if (!key || key === '(not-set)') {
        warn(`Skipping empty or invalid key`);
        continue;
      }

      result = await vaultClient.unseal({ key });
      log(`Key applied. Sealed: ${result.sealed}`);
      if (!result.sealed) {
        log('Vault is now unsealed!');
        break
      }
    }

    status = await vaultClient.status();
    log(`Vault status (after)> sealed: ${status.sealed}`);
  } catch (err) {
    error('Error during unseal process:', err.message || err);
  }
}

if (conf.vault.enable) {
  try {
    const options = {
      apiVersion: 'v1', // default
      endpoint: conf.vault.addr,
      token: conf.vault.token,
    };
    // verbose("vaultClient options:", options)
    vaultClient = NodeVault(options);
    log('Vault client is connected')
    // verbose("vaultClient:", vaultClient)
  } catch (error) {
    error('Vault client connection error:', error.message || error);
  }

  if (conf.vault.unseal) {
    unsealVault();
  }
}

export async function getVaultValue({ vaultKey, userId }) {
  // Vault mode
  if (vaultClient) {
    try {
      const secret = await vaultClient.read(`secret/data/user_${userId}`)
      // verbose('getVaultValue secret:', secret)
      return secret?.data?.data?.[vaultKey] || ''
    } catch (e) {
      error(`Error reading secret ${vaultKey} from Vault for user_${userId}: ${e}`);
      return null;
    }
  }

  // Standalone mode (MongoDB)
  try {
    const secret = await Secret.findOne({
      userId,
      key: vaultKey,
    }).select('value').lean()
    return secret?.value || ''
  } catch (e) {
    error(`Error reading secret ${vaultKey} from MongoDB for user_${userId}: ${e}`);
    return null
  }
}

export async function replaceVaultValues({ obj, userId }) {
  try {
    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && 'valueFromVault' in value) {
          // verbose('Getting vault value (before)> key:', key, ', obj[key]:', obj[key])
          obj[key] = await getVaultValue({ vaultKey: value.valueFromVault, userId });
          // verbose('Getting vault value (after)> key:', key, ', obj[key]:', obj[key])
        } else {
          await replaceVaultValues({ obj: value, userId });
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        await replaceVaultValues({ obj: item, userId });
      }
    }
  } catch (e) {
    error('Error replacing vault values:', e);
  }
}
