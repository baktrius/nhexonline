import mount, { ReconnectingWS } from 'nhex-table-client';

function reportError(message, error) {
    console.error(message, 'Error:', error);
}

if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}
const tableId = JSON.parse(document.getElementById('tableId').textContent);
const roleRequest = JSON.parse(document.getElementById('roleRequest').textContent);
async function fetchResource(resource) {
    try {
        return await (await fetch(`${window.location.protocol}//${window.location.host}/${resource}`)).json();
    } catch (error) {
        reportError(`Unable to fetch resource: ${resource}`, error);
    }
}
fetchResource('serverInfo').then(serverInfo => {
    return mount(document.getElementById('content'), tableId, {
        getArmyInfo: (armyId) => fetchResource(`armies/${armyId}/info/`),
        getBoardInfo: (boardId) => fetchResource(`boards/${boardId}/info/`),
        getBoardImg: (_, img) => img,
        getEmoteImg: (emote) => `/media/${emote}`,
        // getHelp: undefined,
        getTokenImg: (army, token) => `/media/armies/${army}/${token}`,
    }, roleRequest, (conf) => (new ReconnectingWS(`${serverInfo.tss_ws_url}/ws2/`, conf)), serverInfo);
}).then((game) => {
    window.game = game;
}).catch(error => reportError('Unable to load server info', error));
