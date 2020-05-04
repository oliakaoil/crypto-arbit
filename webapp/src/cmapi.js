import axios from 'axios';

export default class cmApi {

  constructor() {

    this.axios = axios.create({
      baseURL: this.getBaseUrl(),
      timeout: 4000,
      withCredentials: true,
      headers: {'Authorization': this.getAuthHeader() },
      validateStatus: function (status) {
        return status >= 200 && status < 500; 
      },  
    });

    this.axios.interceptors.response.use( res => {
        return res;
      }, err => {
        // @todo store.dispatch('siteAlert', { message: 'There was a problem talking to the server. Please try again in a few moments.'  });
        Promise.reject(err);
      });

  }
  
  getBaseUrl() {
    return (process.env.VUE_APP_API_URL ? process.env.VUE_APP_API_URL : '');
  }

  getAuthHeader() {
    return ('apikey=' + (process.env.VUE_APP_API_KEY ? process.env.VUE_APP_API_KEY : '' ));
  }

  ping() {
    return this.axios.get('/status').then(res => res && res.status === 204);
  }

  handleResponse(res) {
    if (!res || !res.data)
      return { error: 'Unkonwn server error' };

    if (res.status === 200)
      return res.data;

    return { error: res.data };
  }


  /*
   * User endpoints
   */ 
  signIn(email, password) {

    return this.axios
            .post('/user/signin', { email: email, password: password })
            .then(r => this.handleResponse(r));
  }  

  signOut() {
    return this.axios.get('/user/signout').then(res => res && res.status === 200);
  }

  getUser() {
    return this.axios.get('/user').then(r => this.handleResponse(r));
  }

  /*
   * Exchange and product endpoints
   */

  getExchangeStatsById(exchangeId) {
    return this.axios.get(`/dashboard/exchange/${exchangeId}`).then(r => this.handleResponse(r));
  }

  getExchanges() {
    return this.axios.get('/dashboard/exchanges').then(r => this.handleResponse(r));
  }

  getProductsByExchangeId(exchangeId) {
    return this.axios.get(`/dashboard/exchange-products/${exchangeId}`).then(r => this.handleResponse(r));
  }

  getOrderbookByProductId(productId) {
    return this.axios.get(`/dashboard/exchange-orderbook/${productId}`).then(r => this.handleResponse(r));
  }

  getOrderbookEngineStats() { 
    return this.axios.get(`/dashboard/orderbook-engine/stats`).then(r => this.handleResponse(r));
  }

  getTarbits() {
    return this.axios.get('/dashboard/tarbits').then(r => this.handleResponse(r));
  }  
}