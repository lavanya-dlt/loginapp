/**
 * Inits the app 
 * (C) 2020 TekMonks. All rights reserved.
 */

const fs = require("fs");
const mustache = require("mustache");

module.exports.initSync = appName => {
    global.APP_CONSTANTS = require(`${__dirname}/../apis/lib/constants.js`);
    global.APP_CONSTANTS.CONF = JSON.parse( mustache.render(fs.readFileSync(`${__dirname}/../conf/app.json`, "utf-8"), 
        {app: appName, hostname: CONSTANTS.HOSTNAME}) );
}