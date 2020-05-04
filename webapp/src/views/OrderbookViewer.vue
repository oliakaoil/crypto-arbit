<template lang="pug">
  div(class='flex flex-wrap justify-between')
    div(class='w-100 mb4 f3')
      | Orderbook Engine
    div(class='w-100 mb4 f5')
      | Choose an exchange and a product below. Up to the first 15 levels of bids and asks will appear and update once per second.   
    div(class='w-100 mb4 flex')
      div(class='w-30')
        v-select(
            @change='loadProducts($event)', 
            v-model="selectedExchangeOption",
            :options="['--'].concat(exchanges)" 
            v-on:search:focus="pauseUpdates()" 
            v-on:search:blur="unpauseUpdates()"             
            )
      div(class='w-20 ml2')
            v-select(
                v-model="selectedProductOption",
                :options="['--'].concat(products)" 
                v-on:search:focus="pauseUpdates()" 
                v-on:search:blur="unpauseUpdates()" 
                )        

    div(class='w-100 mb4 flex')
      div(class='w-50', v-for="side in orderbookSides", :key="side.key")
        div(class='mr2')
          span(class='b')
            | {{ side.label }}
          div(class='mt2')
            div(class='w-100')
              div(class='w-100 flex flex-row')
                div(class='w-50')
                  | Price
                div(class='w-50')
                  | Size            
              div(class='orderbook-level pa2 w-100 flex flex-row', v-for="(level, index) in orderbook[side.key]")
                div(class='w-50')
                  | {{ level.price }}
                div(class='w-50')
                  | {{ level.size }}

    div(class='w-100 mb4 flex flex-wrap content-between')

</template>

<script>

import cmApi from '@/cmapi';
const cmApiInst = new cmApi();

export default {
    name: 'orderbook-viewer-view',
    data: () => {
      return {
        selectedExchangeOption: null,
        selectedProductOption: null,
        selectedExchangeId: 0,
        exchanges: [],
        products: [],
        pauseOrderbookUpdates: false,
        orderbookSides: [
          { key: 'bids', 'label': 'Bids' },
          { key: 'asks', 'label': 'Asks' }
        ],
        orderbook: {
          exchangeId: 0,
          currencyPair: '',
          asks: [],
          bids: []
        }
      };
    },
    components: {
    },
    created: function() {
      cmApiInst.getExchanges().then(response => {

        this.exchanges = response
            .filter(exchange => exchange.localize_type)
            .filter(exchange => exchange.status)
            .map(exchange => {
                return { label: `${exchange.name} [${exchange.id}]`, value: exchange.id };
            });
      });

      this.initLoadOrderbook();
    },
    destroyed: function(){
      this.selectedExchangeOption = '';
      this.selectedProductOption = '';
    },
    methods: {
      pauseUpdates: function() {
        this.pauseOrderbookUpdates = true;
      },
      unpauseUpdates: function() {
        this.pauseOrderbookUpdates = false;
      },
      loadProducts: function() {

        if (!this.selectedExchangeOption)
          return;
        
        this.selectedProductOption = null;
        this.selectedExchangeId = this.selectedExchangeOption.value;

        cmApiInst.getProductsByExchangeId(this.selectedExchangeId).then(response => {

            this.products = response
                .sort((a,b) => {
                    var aName = `${a.base_currency}-${a.quote_currency}`;
                    var bName = `${b.base_currency}-${b.quote_currency}`;
                    if (aName == bName)
                        return 0;
                    return aName > bName ? 1 : -1; 
                })
                .map(product => {
                    return {label: `${product.base_currency}-${product.quote_currency}`, value: product.id};
                });
        });

      },
      initLoadOrderbook: function() {

        // pull orderbook data from the api once per second
        const updateOrderbook = () => {

          if (!this.selectedProductOption || this.pauseOrderbookUpdates) {
            waitUpdateOrderbook(1000);
            return;
          }

          const productId = this.selectedProductOption.value;

          cmApiInst.getOrderbookByProductId(productId).then(response => {
              if (!response || !response.currencyPair) {
                this.$store.dispatch('siteAlert', { message: 'There was a problem, or data is not available.'});
                this.orderbook.bids = [];
                this.orderbook.asks = [];
                waitUpdateOrderbook(3000);
                return;
              }
              response.asks = response.asks.slice(0,15);
              response.bids = response.bids.slice(0,15);

              this.orderbook = response;
              waitUpdateOrderbook(1000);
          });
        };

        const waitUpdateOrderbook = (waitMs) => {
          setTimeout(() => {
              updateOrderbook();
            }, waitMs);
        };        

        updateOrderbook();
      }
    }
}
</script>

<style lang="scss">
  .orderbook-level {
    &:nth-child(even) {
      background-color: $light-gray;
    }
  }
</style>