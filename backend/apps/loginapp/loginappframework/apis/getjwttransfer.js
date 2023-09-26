/**
 * Returns JWT transfer token.
 * (C) 2022 TekMonks. All rights reserved.
 */

const login = require(`${APP_CONSTANTS.API_DIR}/login.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

const DEFAULT_TRANSFER_TOKEN_TIMEOUT = 180000;

exports.doService = async (jsonReq, _servObject, headers, _url, _apiconf) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}

    const id = login.getID(headers);
	LOG.info(`Got JWT transfer request for ID ${id}`);

	const userdetails = await userid.lookupid(id);

	if (userdetails) LOG.info(`Sending transfer for ID ${id}.`); 
	else {LOG.error(`Unable to locate user for ID ${id}, DB error.`); return CONSTANTS.FALSE_RESULT;}

    const jwtTokenManager = APIREGISTRY.getExtension("jwtTokenManager");
	const token = jwtTokenManager.createSignedJWTToken({id: userdetails.id, name: userdetails.name, org: userdetails.org,
        suborg: userdetails.suborg, approved: userdetails.approved == 1, verified: userdetails.verified == 1, 
        onetimekey: jsonReq.onetimekey, appname: jsonReq.appname});

	// expire all transfer tokens after a set timeout
	setTimeout(_=>jwtTokenManager.releaseToken(token), APP_CONSTANTS.CONF.transfer_token_timeout||DEFAULT_TRANSFER_TOKEN_TIMEOUT);
    
    return {jwt: token, ...CONSTANTS.TRUE_RESULT};
}

const validateRequest = jsonReq => jsonReq && jsonReq.onetimekey && jsonReq.appname;