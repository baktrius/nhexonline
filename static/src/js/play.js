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
mount(document.getElementById('content'), tableId, {
    getServerInfo: () => fetchResource('/serverInfo/'),
    getArmyInfo: (armyId) => fetchResource(`army/${armyId}/info/`),
    getBoardInfo: (boardId) => fetchResource(`boards/${boardId}/info/`),
    getBoardImg: (_, img) => img,
    // getEmoteImg: (emote) => emote.image,
    // getHelp: undefined,
    getTokenImg: (army, token) => `/media/${token}`,
}, roleRequest, `${location.protocol == "http:" ? "ws" : "wss"}://${location.hostname}:3001/ws2/`);
