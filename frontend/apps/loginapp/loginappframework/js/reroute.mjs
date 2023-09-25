/** 
 * Unified login re-router. Kicks in when login has been
 * successful to re-route to the calling application.
 * 
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {apimanager as apiman} from "/framework/js/apimanager.mjs";

function doroute() {
    const jwt = apiman.getJWTToken(APP_CONSTANTS.BACKEND);
    const sendtolocation = "https://www.yahoo.com?jwt="+jwt;
    window.location = sendtolocation;
}

export const reroute = {doroute};