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
    const serverInfoPromise = fetchResource('serverInfo');
    import("nhex-table-client").then(async ({ default: mount }) => {
        try {
            const serverInfo = await serverInfoPromise;
            mount(clientRoot, gameId, {
                getArmyInfo: (armyId) => fetchResource(`armies/${armyId}/info.json`),
                getBoardInfo: (boardId) => fetchResource(`boards/${boardId}/info.json`),
                getBoardImg: (boardId, img) => img,
                // getEmoteImg: (emote) => emote.image,
                // getHelp: undefined,
                getTokenImg: (army, token) => `/${token}`,
            }, roleRequest, `${serverInfo.tss_ws_url}/ws2/`, serverInfo);
        } catch (error) {
            reportError('Unable to load server info', error);
        }
    }).catch(error => reportError('Unable to load game client', error));
}

