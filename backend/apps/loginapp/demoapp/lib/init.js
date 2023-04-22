/**
 * Shows how to init apps embedded into the login app.
 * (C) 2023 TekMonks. All rights reserved.
 */

const demoapi = require(`${APP_CONSTANTS.ENV.DEMOAPP_CONSTANTS.API_DIR}/demoapi.js`);

exports.initSync = _ => demoapi.init();