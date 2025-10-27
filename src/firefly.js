import pkg from '@hyperledger/firefly-sdk';
const FireFly = pkg.default;

import { Verbose, log, warn, error } from './services.js'
import conf from './conf.js'

const verbose = Verbose('sd:firefly'); verbose('')

const firefly = new FireFly({
  host: conf.firefly.host,
  namespace: conf.firefly.namespace,
});
export default firefly


/**
 * Converts token balance string to human-readable decimal string
 * @param {string} balance - token balance as string
 * @param {number} decimals - number of decimals
 * @returns {string} - human-readable decimal string
 */
// function tokenToDecimal(balance, decimals = 18) {
export function tokenToDecimal(balance, decimals) {
  if (!decimals) return balance;
  const bigBalance = BigInt(balance);
  const factor = 10n ** BigInt(decimals);
  const integerPart = bigBalance / factor;
  const fractionPart = (bigBalance % factor).toString().padStart(decimals, '0');
  // remove trailing zeros in fractional part
  const fractionTrimmed = fractionPart.replace(/0+$/, '');
  return fractionTrimmed ? `${integerPart}.${fractionTrimmed}` : `${integerPart}`;
}

/**
 * Converts human-readable decimal string to token balance string
 * @param {string} decimalStr - human-readable decimal string
 * @param {number} decimals - number of decimals
 * @returns {string} - token balance as string
 */
// function decimalToToken(decimalStr, decimals = 18) {
export function decimalToToken(decimalStr, decimals) {
  if (!decimals) return decimalStr;
  const [integerPart, fractionPart = ''] = decimalStr.split('.');
  const fractionPadded = (fractionPart + '0'.repeat(decimals)).slice(0, decimals);
  const balance = BigInt(integerPart) * (10n ** BigInt(decimals)) + BigInt(fractionPadded);
  return balance.toString();
}

// // Example usage:
// const balanceStr = "1230166026255794176";
// const decimals = 18;
//
// const decimalString = tokenToDecimal(balanceStr, decimals);
// console.log(decimalString); // "1.230166026255794176"
//
// const backToBalance = decimalToToken(decimalString, decimals);
// console.log(backToBalance); // "1230166026255794176"


export async function getPoolByIdOrSymbol({ poolId = '', symbol = '' } = {}) {
  const pools = await firefly.getTokenPools()
  verbose('pools:', pools)
  let foundPool = null
  if (poolId) {
    foundPool = pools?.find(p => p.id === poolId)
  } else if (!poolId && symbol) {
    foundPool = pools?.find(p => p.symbol === symbol)
  } else {
    throw new Error('Neither pool id nor symbol supplied')
  }
  if (!foundPool) {
    throw new Error('Unknown pool id or symbol')
  }
  verbose('foundPool:', foundPool)
  return foundPool
}

