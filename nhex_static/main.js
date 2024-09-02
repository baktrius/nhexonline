import './style.css'

const createGamePanel = document.getElementById('create_game_panel')
const joinGamePanel = document.getElementById('join_game_panel')
const gameUrl = document.getElementById('game_url')
const createGameButton = document.getElementById('create_game')
const joinGameButton = document.getElementById('play')
const logo = document.getElementById('logo')

async function getNewGameId() {
  return (await (await fetch(`${location.protocol}//${location.hostname}:3001/tables/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      board: 'default',
    })
  })).json()).tableId
}

function setGame(gameId) {
  if (gameId) {
    createGamePanel.style.display = 'none'
    joinGamePanel.style.display = 'block'
    gameUrl.value = window.location.href
  } else {
    createGamePanel.style.display = 'block'
    joinGamePanel.style.display = 'none'
  }
}

window.addEventListener('hashchange', () => {
  setGame(window.location.hash?.slice?.(1))
})

function reportError(message, error) {
  console.error(message, 'Error:', error);
}

async function fetchResource(resource) {
  try {
    return await (await fetch(`${window.location.protocol}//${window.location.host}/${resource}`)).json();
  } catch (error) {
    reportError(`Unable to fetch resource: ${resource}`, error);
  }
}

function joinGame() {
  joinGameButton.disabled = true
  joinGameButton.value = 'Joining...'
  import('nhex-table-client').then(({ default: mount }) => {
    const gameId = window.location.hash?.slice?.(1)
    const clientRoot = document.createElement('body')
    clientRoot.id = 'game'
    document.body = clientRoot
    const roleRequest = { role: "player" };

    mount(clientRoot, gameId, {
      getServerInfo: () => fetchResource('serverInfo'),
      getArmyInfo: (armyId) => fetchResource(`armies/${armyId}/info.json`),
      getBoardInfo: (boardId) => fetchResource(`boards/${boardId}/info.json`),
      getBoardImg: (boardId, img) => `boards/${boardId}/${img}`,
      // getEmoteImg: (emote) => emote.image,
      // getHelp: undefined,
      getTokenImg: (army, token) => `/${token}`,
    }, roleRequest, `${location.protocol == "http:" ? "ws" : "wss"}://${location.hostname}:3001/ws2/`);

    window.addEventListener('hashchange', () => {
      // reload the page
      window.location.reload()
    })
  })
}

if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
}


setGame(window.location.hash?.slice?.(1))
createGameButton.addEventListener('click', async () => {
  createGameButton.disabled = true
  createGameButton.value = 'Creating...'
  try {
    window.location.hash = await getNewGameId()
  } catch (error) {
    reportError('Unable to create a new game', error)
  }
  createGameButton.disabled = false
  createGameButton.value = 'Create new game'
})
joinGameButton.addEventListener('click', joinGame)

logo.addEventListener('click', () => {
  window.location.hash = ''
})