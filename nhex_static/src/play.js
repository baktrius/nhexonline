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

const resources = {
    getArmyInfo: (armyId) => fetchResource(`armies/${armyId}/info.json`),
    getBoardInfo: (boardId) => fetchResource(`boards/${boardId}/info.json`),
    getBoardImg: (boardId, img) => img,
    // getEmoteImg: (emote) => emote.image,
    // getHelp: undefined,
    getTokenImg: (army, token) => `/armies/${army}/${token}`,
}



async function getLocalTable(board) {
    const { default: Table } = await import('nhex-tss/table');
    const table = new Table("local",
        0,
        {
            cmds: [{ act: { board } }],
            async load() {
                return this.cmds;
            },
            initDumping() { },
            dump(place, important = false, action = undefined) {
                const cmd = { prev: this.simplifyPlace(place) };
                if (action !== undefined) {
                    cmd.act = action;
                }
            },
            close() { },
            getCurrentPlace() {
                return { line: this.cmds.length - 1 };
            }
        },
        (change) => {
            console.log('change', change);
        },
        () => {
            console.log('unload');
        },
        undefined
    );
    await table.load();
    let nextUserId = 0;

    async function subscribeTable(ws, id, roleRequest) {
        if (id !== 'local') {
            ws.send(JSON.stringify({ table: false }));
            return;
        }
        if (!(await table.addUser(ws, roleRequest))) {
            ws.send(JSON.stringify({ table: false }));
        }
    }

    async function handleMessage(ws, data) {
        if (data.nick !== undefined) ws.userData.userName = data.nick;
        if (data.monitor === true) console.warn('Monitor not implemented');
        if (data.subscribe !== undefined) console.warn('Tables list subscribe not implemented');
        if (data.subscribeTable !== undefined)
            await subscribeTable(ws, data.subscribeTable.id, data.subscribeTable.roleRequest);
        if (data.delays !== undefined)
            ws.userData.delays = ws.userData.delays.concat(data.delays);
        if (data.request !== undefined)
            ws.send(JSON.stringify({ request: data.request }));
    }

    return (conf) => {
        const ws = {
            init: () => conf.onopen(),
            send: (data) => {
                conf.onmessage({ data });
            },
            handlers: new Map(),
            userData: {
                userId: nextUserId++,
                delays: [],
                sent: 0,
                sentBytes: 0,
                pinged: 0,
                received: 0,
                receivedBytes: 0,
                pongs: 0,
                active: true,
                cookie: undefined,
            },
            onMessage: handleMessage,
            on(event, handler) {
                console.log('on', event);
                if (this.handlers.has(event)) {
                    this.handlers.get(event).push(handler);
                }
                ws.handlers.set(event, [handler]);
            },
        }

        queueMicrotask(async () => {
            await ws.init();
            ws.send(JSON.stringify({ account: false }));
        });
        return {
            send: (message) => {
                queueMicrotask(() => {
                    if (message === '{}') {
                        ws.send('{}');
                        return;
                    }
                    const data = JSON.parse(message);
                    if (typeof ws.onMessage !== 'function') {
                        console.error('No onMessage handler', ws, message);
                        return;
                    }
                    ws.onMessage(ws, data);
                });
            },
            close: (code, reason) => console.log('close'),
            setReconnect(value) { },
            terminate(code, reason) {
                this.setReconnect(false);
                this.close(code, reason);
            },
        }
    };
}

const gameId = location.hash?.slice?.(1)
if (!gameId) {
    reportError('Game ID not found in URL');
} else {
    const roleRequest = { role: "player" };
    const serverInfoPromise = fetchResource('serverInfo');
    import("nhex-table-client").then(async ({ default: mount, ReconnectingWS }) => {
        try {
            const serverInfo = await serverInfoPromise;
            let getConnection = (conf) => (new ReconnectingWS(`${serverInfo.tss_ws_url}/ws2/`, conf));
            if (gameId === 'local') {
                getConnection = await getLocalTable("a-aZL7PodI6Z");
            }
            mount(clientRoot, gameId, resources, roleRequest, getConnection, serverInfo);
        } catch (error) {
            reportError('Unable to load server info', error);
        }
    }).catch(error => reportError('Unable to load game client', error));
}

