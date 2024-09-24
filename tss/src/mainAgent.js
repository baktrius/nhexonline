import axios from 'axios';
export default (class MainServer {
  constructor(url) {
    this.url = url;
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
});
