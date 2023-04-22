/** 
 * Shows how to embed an app inside loginapp.
 * 
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

import {util} from "/framework/js/util.mjs"
import {router} from "/framework/js/router.mjs";

const MODULE_PATH = util.getModulePath(import.meta), 
    MAIN_HTML = util.resolveURL(`${MODULE_PATH}/../main.html`);

const main = async (data, _mainLoginAppModule) => {
    return await router.loadHTML(MAIN_HTML, {...data}); 
}

export const demoapp = {main};