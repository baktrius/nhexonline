const axios = require('axios');

module.exports = class MainServer {
  constructor(url) {
    this.url = url;
  }

  async getTableById(id) {
    try {
      const res = (await axios.get(`${this.url}/tables/${id}/info/`)).data;
      return res;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
  async getArmy(id) {
    return (await axios.get(`${this.url}/armies/${id}/info/`)).data;
  }
  async authorizeRoleRequest(ws, tableId, roleRequest) {
    try {
      return (await axios.post(`${this.url}/authorizeRoleRequest/`, { tableId, roleRequest }, {
        headers: {
          Cookie: ws.userData.cookie,
        }
      })).data;
    } catch (error) {
      return false;
    }
  }
}