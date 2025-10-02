import cron from 'node-cron';
// import { inspect } from 'util'

import { log, warn, error, Verbose } from '../services.js'
// import conf, { revealConf } from '../conf.js'
import autopayment from './autopayment.js'

// log('public conf:', inspect(revealConf(), { colors: true, depth: null }))

// In cron syntax, the fields are:
//
//   ┌────────────── second (optional)
//   │ ┌──────────── minute (0 - 59)
//   │ │ ┌────────── hour (0 - 23)
//   │ │ │ ┌──────── day of month (1 - 31)
//   │ │ │ │ ┌────── month (1 - 12)
//   │ │ │ │ │ ┌──── day of week (0 - 7) (0 or 7 = Sunday)
//   │ │ │ │ │ │
//   │ │ │ │ │ │
//   * * * * * *


// // Every minute
// cron.schedule("* * * * *", () => {
//   console.log(`[${new Date().toISOString()}] Minute log message`);
// });

// // Every 5 minutes (0, 5, 10, 15, ... 55)
// cron.schedule("*/5 * * * *", () => {
//   log(`[${new Date().toISOString()}] Every 5 minutes log message`);
//   autopayment()
// });
// Every 1 minutes (0, 5, 10, 15, ... 55)
cron.schedule("*/1 * * * *", async () => {
  log(`[${new Date().toISOString()}] Every 1 minute log message`);
  await autopayment()
});

// // Every hour
// cron.schedule("0 * * * *", () => {
//   console.log(`[${new Date().toISOString()}] Hourly log message`);
// });

// // Every day at 12 am
// cron.schedule("0 0 * * *", () => {
//   console.log(`[${new Date().toISOString()}] Daily log message (midnight)`);
// });

// // On the 1st of every month at 12 am
// cron.schedule("0 0 1 * *", () => {
//   console.log(`[${new Date().toISOString()}] Monthly log message (beginning of month)`);
// });

// // On Jan 1st at 12 am (once a year)
// cron.schedule("0 0 1 1 *", () => {
//   console.log(`[${new Date().toISOString()}] Yearly log message (Happy New Year 🎉)`);
// });

// console.log("Scheduler started. Waiting for jobs...");

