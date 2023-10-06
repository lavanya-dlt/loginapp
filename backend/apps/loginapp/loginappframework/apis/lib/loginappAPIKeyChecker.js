/** 
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 * 
 * Checks JWT tokerns or just org based API keys.
 */

const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const login = require(`${LOGINAPP_CONSTANTS.API_DIR}/login.js`);
const userid = require(`${LOGINAPP_CONSTANTS.LIB_DIR}/userid.js`);

const CHECKER_NAME = "loginapp_key_checker";

function initSync() {
    APIREGISTRY.addCustomSecurityChecker(CHECKER_NAME, this);
}

async function checkSecurity(apiregentry, _url, req, headers, _servObject, reason) {
    if (!req.org) {
        LOG.error(`Incoming request ${JSON.stringify(req)} does not have org key set. Authorization Rejected.`);
        reason.reason = "API Key Error"; reason.code = 403; return false; // loginapp uses org based keys for APIs
    }

    if (!await isAPIKeySecure(headers, req.org)) {  // first perform a basic API key check
        LOG.error(`Incoming request ${JSON.stringify(req)} does not have a proper org key for the API.`);
        reason.reason = "API Key Error"; reason.code = 403; return false;   // key not found in the headers
    }

    if (apiregentry.query.loginapp_key_checker_enforce_for_jwt) {   // if the request carries a proper JWT, then use the stronger JWT check.
        let allJWTClaimsCheck = true; 
        for (const enforcedClaim of utils.escapedSplit(apiregentry.query.loginapp_key_checker_enforce_for_jwt, ",")) {
            if (enforcedClaim.trim() == "id" && login.getID(headers) != req.id) allJWTClaimsCheck = false;
            if (enforcedClaim.trim() == "org" && login.getOrg(headers).toLowerCase() != req.org.toLowerCase()) allJWTClaimsCheck = false;
        }
        if (allJWTClaimsCheck) return true; // request was properly JWT authorized and key checks too
        reason.reason = "JWT Claim Error"; reason.code = 403; return false;   // JWT claims failed and enforcement was requested
    }
    
    LOG.warn(`Incoming request ${JSON.stringify(req)} for org ${req.org} is not carrying a proper JWT token, passed using weaker API key only check.`);
    return true;
}

async function isAPIKeySecure(headers, org) {
	const incomingKey = APIREGISTRY.getExtension("apikeychecker").getIncomingAPIKey(headers);
	const orgKeys = await userid.getKeysForOrg(org);
	return orgKeys.includes(incomingKey);
}

module.exports = {checkSecurity, initSync, isAPIKeySecure};