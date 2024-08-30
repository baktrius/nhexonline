export default class ReconnectingWS {
  constructor(
    des,
    {
      onopen = function () {},
      onreconnect = function () {},
      onmessage = function () {},
      onerror = function () {},
      onconnectionlost = function () {},
      onreconnecting = function () {},
      onclose = function () {},
      reconnection_delay = 1000,
      autoReconnect = true,
    } = {},
  ) {
    this.autoReconnect = autoReconnect;
    this.connected = false;
    const connect = (again) => {
      this.ws = new WebSocket(des);
      if (again) {
        this.ws.onopen = (event) => {
          this.connected = true;
          onreconnect(event);
        };
      } else {
        this.ws.onopen = (event) => {
          this.connected = true;
          onopen(event);
        };
      }
      this.ws.onmessage = onmessage;
      this.ws.onerror = (event) => {
        onerror(event);
        this.ws.close();
      };
      this.ws.onclose = (event) => {
        if (this.connected) {
          onconnectionlost(event);
          if (this.autoReconnect) {
            onreconnecting(event);
            setTimeout(connect.bind(this, true), reconnection_delay);
          } else onclose(event);
          this.connected = false;
        }
      };
    };
    connect(false);
    this.reconnect = () => {
      if (!this.connected) connect(true);
    };
  }
  close(code, reason) {
    this.ws.close(code, reason);
  }
  setReconnect(value) {
    this.autoReconnect = value;
  }
  terminate(code, reason) {
    this.setReconnect(false);
    this.close(code, reason);
  }
  send(data) {
    this.ws.send(data);
  }
}
