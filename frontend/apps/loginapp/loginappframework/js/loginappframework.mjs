/**
 * Main entry point for the post-login page.
 * (C) 2023 Tekmonks
 */

const USER_MANAGER_CONTENT = `
    <user-manager id="uman" style="width: 100%; height: 100%;" 
        backendurl="${APP_CONSTANTS.BACKEND}/apps/${APP_CONSTANTS.APP_NAME}" 
        logoutcommand="monkshu_env.apps[APP_CONSTANTS.APP_NAME].loginmanager.logout()">
    </user-manager>
`;

function main(data, _mainModule) {
    data.maincontent = USER_MANAGER_CONTENT;
}

export const loginappframework = {main};