const clientRoot = document.getElementById('gameWrapper');


if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}

function reportError(message, error) {
    console.error(message, 'Error:', error);
    clientRoot.innerHTML = `<div class="error">${message}</div>`;
}

async function fetchResource(resource) {
    try {
        return await (await fetch(`${location.protocol}//${location.host}/${resource}`)).json();
    } catch (error) {
        reportError(`Unable to fetch resource: ${resource}`, error);
    }
}

const gameId = location.hash?.slice?.(1)
if (!gameId) {
    reportError('Game ID not found in URL');
} else {
    const roleRequest = { role: "player" };
    import("nhex-table-client").then(({ default: mount }) => {
        mount(clientRoot, gameId, {
            getServerInfo: () => fetchResource('serverInfo'),
            getArmyInfo: (armyId) => fetchResource(`armies/${armyId}/info.json`),
            getBoardInfo: (boardId) => fetchResource(`boards/${boardId}/info.json`),
            getBoardImg: (boardId, img) => `boards/${boardId}/${img}`,
            // getEmoteImg: (emote) => emote.image,
            // getHelp: undefined,
            getTokenImg: (army, token) => `/${token}`,
        }, roleRequest, `${location.protocol == "http:" ? "ws" : "wss"}://${location.hostname}:3001/ws2/`);
    }).catch(error => reportError('Unable to load game client', error));
}

