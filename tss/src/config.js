const QUALITY_LEVELS = [
  { mouseUpdateCoolDown: -1, emotesCoolDown: [0, 0] },
  { mouseUpdateCoolDown: -1, emotesCoolDown: [1, 5000] },
  { mouseUpdateCoolDown: 500, emotesCoolDown: [3, 10000] },
  { mouseUpdateCoolDown: 250, emotesCoolDown: [9, 20000] },
  { mouseUpdateCoolDown: 150, emotesCoolDown: [20, 20000] },
  { mouseUpdateCoolDown: 100, emotesCoolDown: [20, 20000] },
];
const ADDITIONAL_QUALITY = 2;

module.exports = {
  SALT_ROUNDS: 7,
  ENABLE_TIMEOUT: true,
  CONNECTION_TIMEOUT: 20000,
  PING_TIMEOUT: 5000,
  STATS_SERVICE_INTERVAL: 5000,
  ADDITIONAL_QUALITY,
  QUALITY_LEVELS,
  QUALITY_LEVELS_NUM: QUALITY_LEVELS.length + ADDITIONAL_QUALITY - 1,
  ADJUST_SERVICE_QUALITY: true,
  INCREASE_QUALITY_THRESHOLD: 200,
  DECREASE_QUALITY_THRESHOLD: 300,
  DOUBLE_DECREASE_QUALITY_THRESHOLD: 500,
  ADJUST_SERVICE_WS_CONNECTION_THRESHOLD: 8,
  ADJUST_SERVICE_INCREASE_INSENSITIVITY: 2,
  ADJUST_SERVICE_DECREASE_INSENSITIVITY: 3,
  ARMY_SIZE_LIMIT: 1024 * 1024 * 2,
};
