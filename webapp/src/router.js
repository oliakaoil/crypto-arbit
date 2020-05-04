import Vue from 'vue';
import Router from 'vue-router';
import PageNotFound from '@/views/PageNotFound.vue';
import Home from '@/views/Home.vue';
import Dashboard from '@/views/Dashboard.vue';
import SpotPriceComparator from '@/views/SpotPriceComparator.vue';
import OrderbookViewer from '@/views/OrderbookViewer.vue';
import ExchangeViewer from '@/views/ExchangeViewer.vue';
import TarbitList from '@/views/TarbitList.vue';

Vue.use(Router);


export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/spot-price-comparator',
      name: 'spot-price-comparator',
      component: SpotPriceComparator,
    },     
    {
      path: '/orderbook-viewer',
      name: 'orderbook-viewer',
      component: OrderbookViewer,
    },    
    {
      path: '/exchange-stats',
      name: 'exchange-stats',
      component: ExchangeViewer,
    },         
    {
      path: '/tarbit-list',
      name: 'tarbit-list',
      component: TarbitList,
    },       
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
    },    
    { 
      path: "*", 
      component: PageNotFound 
    }
  ]
});