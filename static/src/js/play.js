import mount from 'nhex-table-client';

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
    mount(document.getElementById('content'), tableId, {
        getArmyInfo: (armyId) => fetchResource(`armies/${armyId}/info/`),
        getBoardInfo: (boardId) => fetchResource(`boards/${boardId}/info/`),
        getBoardImg: (_, img) => img,
        // getEmoteImg: (emote) => emote.image,
        // getHelp: undefined,
        getTokenImg: (army, token) => `/media/${token}`,
    }, roleRequest, `${serverInfo.tss_ws_url}/ws2/`, serverInfo);
}).catch(error => reportError('Unable to load server info', error));
