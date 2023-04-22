/** 
 * Demo app constants
 * (C) 2023 TekMonks. All rights reserved.
 */

const path = require("path");

const APP_ROOT = APP_CONSTANTS.APP_ROOT;

exports.APP_ROOT = APP_ROOT;
exports.LIB_DIR = path.resolve(__dirname);
exports.API_DIR = path.resolve(`${__dirname}/../apis`);
exports.CONF_DIR = path.resolve(`${__dirname}/../conf`);
exports.DB_DIR = `${APP_ROOT}/db`;