/**
 * User ID management support, database layer.
 * (C) 2021 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */
const util = require("util");
const path = require("path");
const bcryptjs = require("bcryptjs");
const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const DB_PATH = path.resolve(`${APP_CONSTANTS.DB_DIR}/loginapp.db`);
const DB_CREATION_SQLS = require(`${APP_CONSTANTS.DB_DIR}/loginapp_dbschema.json`);
const ID_BLACK_WHITE_LISTS = require(`${APP_CONSTANTS.CONF_DIR}/idblackwhitelists.json`)
const db = require(`${CONSTANTS.LIBDIR}/db.js`).getDBDriver("sqlite", DB_PATH, DB_CREATION_SQLS);

const idDeletionListeners = [];

exports.initDB = async _ => await db.init();

exports.register = async (id, name, org, pwph, totpSecret, role, approved, verifyEmail=1, domain) => {
	const existsID = await exports.existsID(id);
	if (existsID.result) return({result:false, reason: exports.ID_EXISTS}); 

	const pwphHashed = await _getUserHash(pwph);

	let finalResult = true;
	const existingRootOrg = await exports.getRootOrg(org); if (!existingRootOrg) {
		const orgCreateResult = await exports.addOrUpdateOrg(org, name, id, undefined, domain, 
			undefined, undefined);	// Why? Because this root org doesn't exist so must add it
		if (!orgCreateResult.result) finalResult = false;
	}

	if (finalResult) {
		finalResult = await db.runCmd(
			"INSERT INTO users (id, name, org, suborg, pwph, totpsec, role, approved, verified, domain) VALUES (?,?,?,?,?,?,?,?,?,?)",
			[id, name, existingRootOrg||org, org, pwphHashed, totpSecret, role, approved?1:0, verifyEmail?0:1, domain]);
		if ((!finalResult) && (!existingRootOrg)) await exports.deleteOrg(org);	// undo root org creation if admin insert failed
	}

	return {result: finalResult, id, name, org: existingRootOrg||org, suborg: org, pwph: pwphHashed, 
		totpsec: totpSecret, role, approved:approved?1:0, verified:verifyEmail?0:1, domain};
}

exports.deleteUser = async id => {
	const existsID = await exports.existsID(id);
	if (!existsID.result) return({result:false}); 

	for (const idDeletionListener of idDeletionListeners) if (!(await idDeletionListener(id))) return {result: false};

	const deleteResult = await db.runCmd("DELETE FROM users WHERE id = ?", [id]);

	if (deleteResult) {	// if no users left, delete the org
		const orgUsersRemaining = await exports.getUsersForRootOrg(existsID.org); 
		if (!orgUsersRemaining.users?.length) await this.deleteOrg(existsID.org);	
	}
	
	return {result: deleteResult, id};
}

exports.addIDDeletionListener = listener => idDeletionListeners.push(listener);

exports.updateUser = async (oldid, id, name, org, oldPwphHashed, newPwph, totpSecret, role, approved, domain) => {
	const pwphHashed = newPwph?await _getUserHash(newPwph):oldPwphHashed, rootOrg = await exports.getRootOrg(org);
	if (!rootOrg) { LOG.error(`DB error for ID update ${oldid} the given org ${org} doesn't match any root org.`);
		return {result: false}; }
	const commandsToUpdate = [
		{
			cmd: "UPDATE users SET id=?, name=?, org=?, suborg = ?, pwph=?, totpsec=?, role = ?, approved = ?, domain = ? WHERE id=?", 
			params: [id, name, rootOrg, org, pwphHashed, totpSecret, role, approved, domain, oldid]
		},
		{
			cmd: `INSERT OR IGNORE INTO domains (domain, org) values (?,?);`,
			params: [domain, rootOrg]
		}
	];
	const updateResult = await db.runTransaction(commandsToUpdate);

	return {result: updateResult, oldid, id, name, org: rootOrg, suborg: org, pwph: pwphHashed, 
		totpSecret, role, approved, domain};
}

exports.checkPWPH = async (id, pwph) => {
	const idEntry = await exports.existsID(id); if (!idEntry.result) return {result: false, reason: exports.NO_ID}; 
	const pwphCompareResult = await (util.promisify(bcryptjs.compare))(pwph, idEntry.pwph);
	return {...idEntry, result: pwphCompareResult, reason: exports.BAD_PASSWORD}; 
}

exports.existsID = exports.getTOTPSec = async id => {
	const rows = await db.getQuery("SELECT * FROM users WHERE id = ? COLLATE NOCASE", [id]);
	if (rows && rows.length) return {result: true, ...(rows[0])}; else return {result: false};
}

exports.changepwph = async (id, pwph) => {
	const pwphHashed = await _getUserHash(pwph);
	return {result: await db.runCmd("UPDATE users SET pwph = ? WHERE id = ? COLLATE NOCASE", [pwphHashed, id])};
}

exports.getUsersForOrgOrSuborg = async orgOrSubOrg => {
	const users = await db.getQuery("SELECT * FROM users WHERE org = ? OR suborg = ? COLLATE NOCASE", [orgOrSubOrg, orgOrSubOrg]);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getUsersForRootOrg = async org => {
	const users = await db.getQuery("SELECT * FROM users WHERE org = ? COLLATE NOCASE", [org]);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getUsersForSuborg = async suborg => {
	const users = await db.getQuery("SELECT * FROM users WHERE suborg = ? COLLATE NOCASE", [suborg]);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getRootOrg = async suborg => {
	const rootOrg = await db.getQuery("SELECT org FROM suborgs WHERE name = ? COLLATE NOCASE", [suborg]);
	if (rootOrg && rootOrg.length) return rootOrg[0].org; else return null;
}

exports.getSubOrgs = async rootorg => {
	const suborgs = await db.getQuery("SELECT name FROM suborgs WHERE org = ? COLLATE NOCASE", [rootorg]);
	if (suborgs && suborgs.length) return _flattenArray(suborgs, "name"); else return null;
}

exports.getUsersForDomain = async domain => {
	const users = await db.getQuery("SELECT * FROM users WHERE domain = ? COLLATE NOCASE", [domain]);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getOrgForDomain = async domain => {
	const orgs = await db.getQuery("SELECT org FROM domains WHERE domain = ? COLLATE NOCASE", [domain]);
	if (orgs && orgs.length) return orgs[0].org; else return null;
}

exports.getDomainsForOrg = async org => {
	const domains = await db.getQuery("SELECT domain FROM domains WHERE org = ? COLLATE NOCASE", [org]);
	if (domains && domains.length) return _flattenArray(domains, "domain", domain => domain.toLowerCase()); else return null;
}

exports.approve = async id => {
	return {result: await db.runCmd("UPDATE users SET approved=1 WHERE id=?", [id])};
}

exports.verifyEmail = async id => {
	return {result: await db.runCmd("UPDATE users SET verified=1 WHERE id=? AND verified=0", [id])};
}

exports.deleteAllUnverifiedAndExpiredAccounts = async verificationExpiryInSeconds => {
	const unverifiedRows = await db.getQuery(`SELECT * FROM users WHERE verified=0 AND ${serverutils.getUnixEpoch()}-registerdate>=${verificationExpiryInSeconds}`, 
		[]);
	if ((!unverifiedRows) || (!Array.isArray(unverifiedRows))) {LOG.error("Error deleting unverified accounts due to DB error."); return {result: false};}
	const usersDropped = []; for (const unverifiedRow of unverifiedRows) 
		if ((await exports.deleteUser(unverifiedRow.id)).result) usersDropped.push(unverifiedRow);
	return {result: true, usersDropped};
}

exports.updateLoginStats = async (id, date, ip="unknown") => {
	const rows = (await db.getQuery("SELECT * FROM users WHERE id = ? COLLATE NOCASE", [id]))[0];
	const currentLoginsAndIPsJSON = JSON.parse(rows.loginsandips_json||"[]"); currentLoginsAndIPsJSON.unshift({date, ip});
	const maxLoginsToRemember = APP_CONSTANTS.CONF.max_logins_to_remember||100;
	if (currentLoginsAndIPsJSON.length > maxLoginsToRemember) currentLoginsAndIPsJSONawait = currentLoginsAndIPsJSON.slice(0, maxLoginsToRemember);
	await db.runCmd("UPDATE users SET lastlogin=?, lastip=?, loginsandips_json=? WHERE id=?", [date, ip, 
		JSON.stringify(currentLoginsAndIPsJSON), id]);
}

exports.getAdminsFor = async id => {
	const admins = await db.getQuery("SELECT * FROM users WHERE role = 'admin' AND org = (select org from users where id = ? COLLATE NOCASE) COLLATE NOCASE", [id]);
	if (admins && admins.length) return admins; else return null;
}

exports.shouldAllowDomain = async domain => {
	const orgMainDomain = _flattenArray(	// check if this domain is registered already and if so check its main domain in the whitelist
		await db.getQuery("SELECT domain FROM orgs WHERE name IN (SELECT org FROM domains WHERE domain=? COLLATE NOCASE LIMIT 1);",[domain]),
		"domain", domain => domain.toLowerCase())[0];

	// if in whitelist only mode activated so check if this domain or this org's main domain is whitelisted
	if (APP_CONSTANTS.CONF.id_whitelist_mode) return ID_BLACK_WHITE_LISTS.whitelist.includes(orgMainDomain||domain.toLowerCase());	
	// blacklist check
	const isSubdomainOrMainDomainInBlacklist = ID_BLACK_WHITE_LISTS.blacklist.includes(domain.toLowerCase()) || 
		ID_BLACK_WHITE_LISTS.blacklist.includes((orgMainDomain||domain).toLowerCase());
	if (APP_CONSTANTS.CONF.id_blacklist_mode) return (!isSubdomainOrMainDomainInBlacklist);	
}

exports.addOrUpdateOrg = async (name, primary_contact_name="", primary_contact_email, address="", domain, 
		alternate_names=[], alternate_domains=[]) => {
			
	const transactions = [];
	transactions.push({cmd: "INSERT INTO orgs (name, primary_contact_name, primary_contact_email, address, domain) values (?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET primary_contact_name=?, primary_contact_email=?, address=?, domain=?", 
		params:[name, primary_contact_name, primary_contact_email, address, domain, 
			primary_contact_name, primary_contact_email, address, domain]});
	transactions.push({cmd:"DELETE FROM domains WHERE org = ?", params: [name]});
	transactions.push({cmd:"DELETE FROM suborgs WHERE org = ?", params: [name]});
	for (const domainThis of [...alternate_domains, domain]) transactions.push({
		cmd: "INSERT INTO domains (domain, org) VALUES (?,?)", params: [domainThis, name]});
	for (const alternateName of [...alternate_names, name]) transactions.push({
		cmd: "INSERT INTO suborgs (name, org) VALUES (?,?)", params: [alternateName, name]});

	const updateResult = await db.runTransaction(transactions);

	// as the user may have dropped domains or suborgs - delete orphans
	const orphanedSuborgs = _flattenArray(await db.getQuery("SELECT DISTINCT suborg FROM users WHERE org = ? MINUS SELECT name FROM suborgs WHERE org = ?", [org, org]),
		"suborg");
	const orphanedDomains = _flattenArray(await db.getQuery("SELECT DISTINCT domain FROM users WHERE org = ? MINUS SELECT domain FROM domains WHERE org = ?", [org, org]),
		"domain");
	if (orphanedSuborgs.length) LOG.info(`Dropping suborgs ${JSON.stringify(orphanedSuborgs)} as a result of org edit orphans them.`);
	if (orphanedDomains.length) LOG.info(`Dropping domains ${JSON.stringify(orphanedDomains)} as a result of org edit orphans them.`);
	for (const orphanedOrg of orphanedSuborgs) await exports.deleteSuborg(orphanedOrg);
	for (const orphanedDomain of orphanedDomains) await exports.deleteDomain(orphanedDomain);

	return {result: updateResult, name, primary_contact_name, primary_contact_email, address, domain, 
		alternate_names, alternate_domains};
}

exports.getOrgsAndSuborgsMatching = async org => {
	const orgs = await db.getQuery("SELECT DISTINCT name FROM suborgs WHERE name LIKE ? COLLATE NOCASE", [org]);
	if (orgs && orgs.length) return {result: true, orgs}; else return {result: true, orgs:[]};
}

exports.getOrg = async org => {
	const orgs = await db.getQuery("SELECT * FROM orgs WHERE name is ? COLLATE NOCASE", [org]);
	if (orgs && orgs.length) return {result: true, ...orgs[0]}; else return {result: false};
}

exports.deleteOrg = async org => {
	const usersForOrg = await exports.getUsersForRootOrg(org), suborgsForOrg = await exports.getSubOrgs(org),
		domainsForOrg = await exports.getDomainsForOrg(org);
	if ((!usersForOrg) || (!suborgsForOrg) || (!domainsForOrg)) return {result: false, org};

	const deleteResult = await db.runCmd("DELETE FROM orgs WHERE name = ?", [org]);

	if (deleteResult) {	// delete corresponding users, suborgs and domains
		for (const user of usersForOrg.users) if (!(await exports.deleteUser(user.id, dbEntryAlreadyDropped)).result)
			LOG.warn(`Deletion of org ${org} orphaned user ${user.id} as deletion of this user failed.`);
		for (const suborg of suborgsForOrg) if (!(await exports.deleteSuborg(suborg)).result)
			LOG.warn(`Deletion of org ${org} orphaned suborg ${suborg} as deletion of this suborg failed.`);
		for (const domain of domainsForOrg) if (!(await exports.deleteDomain(domain)).result) 
			LOG.warn(`Deletion of org ${org} orphaned domain ${domain} as deletion of this domain failed.`);;
	}

	return {result: deleteResult, org};
}

exports.addSuborg = async (suborg, org) => {
	return {result: await db.runCmd("INSERT OR IGNORE INTO suborgs (name, org) VALUES (?,?)", [suborg, org]), suborg, org};
}

exports.deleteSuborg = async suborg => {
	const usersForSuborg = await exports.getUsersForSuborg(org);
	const suborgDeletionResult = await db.runCmd("DELETE FROM suborgs WHERE name = ?", [suborg]);

	if (suborgDeletionResult) {	// if suborg is deleted then drop all its users too
		for (const user of usersForSuborg.users) if (!(await exports.deleteUser(user.id, dbEntryAlreadyDropped)).result)
			LOG.warn(`Deletion of suborg ${org} orphaned user ${user.id} as deletion of this user failed.`);
	}
	return {result: suborgDeletionResult, suborg};
}

exports.addDomain = async (domain, org) => {
	return {result: await db.runCmd("INSERT OR IGNORE INTO domains (domain, org) VALUES (?,?)", [domain, org]), domain, org};
}

exports.deleteDomain = async domain => {
	const usersForDomain = await exports.getUsersForDomain(domain);
	const domainDeletionResult = await db.runCmd("DELETE FROM domains WHERE domain = ?", [domain]);

	if (domainDeletionResult) {	// if domain is deleted then drop all its users too
		for (const user of usersForDomain.users) if (!(await exports.deleteUser(user.id, dbEntryAlreadyDropped)).result)
			LOG.warn(`Deletion of domain ${domain} orphaned user ${user.id} as deletion of this user failed.`);
	}
	return {result: domainDeletionResult, domain};
}

const _getUserHash = async text => await (util.promisify(bcryptjs.hash))(text, 12);

function _flattenArray(results, columnName, functionToCall) { 
	if (!results) return [];
	const retArray = []; for (const result of results) retArray.push(
		functionToCall?functionToCall(result[columnName]):result[columnName]); return retArray;
}

exports.ID_EXISTS = "useridexists"; exports.NO_ID = "noid"; exports.BAD_PASSWORD = "badpassword";