/**
 * Shows how to init apps embedded into the login app.
 * (C) 2023 TekMonks. All rights reserved.
 */

const APP_NAME = "demoapp"; // change this to the embedded app name

exports.initSync = function() {
    global.LOGINAPP_CONSTANTS.ENV[`${APP_NAME.toUpperCase()}_CONSTANTS`] = 
        require(`${LOGINAPP_CONSTANTS.APP_ROOT}/${APP_NAME}/lib/${APP_NAME}constants.js`);
    global.LOGINAPP_CONSTANTS.ENV[`${APP_NAME.toUpperCase()}_CONSTANTS`].APP_NAME = APP_NAME;

    require(`${LOGINAPP_CONSTANTS.ENV[`${APP_NAME.toUpperCase()}_CONSTANTS`].LIB_DIR}/init.js`).initSync();
}