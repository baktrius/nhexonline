async function fetchResource(resource) {
  return await (await fetch(`${location.protocol}//${location.host}/${resource}`)).json();
}

export default {
  getServerInfo: () => fetchResource('serverInfo'),
  getArmyInfo: (armyId) => fetchResource(`armies/${armyId}/info.json`),
  getBoardInfo: (boardId) => fetchResource(`boards/${boardId}/info.json`),
  getBoardImg: (boardId, img) => img,
  // getEmoteImg: (emote) => emote.image,
  // getHelp: undefined,
  getTokenImg: (army, token) => `/armies/${army}/${token}`,
};