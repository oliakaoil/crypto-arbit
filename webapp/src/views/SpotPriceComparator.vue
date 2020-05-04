<template lang="pug">
  div(class='flex flex-wrap justify-between')
    div(class='w-100 mb4 bold')
      | Spot Price Comparartor
    div(class='w-100 mb4')
      v-select(
        @change='loadProduct($event)', 
        v-model="selectedCurrencyPair",
        :options="['--'].concat(products)"
        )
    div(class='w-100 mb4 flex flex-wrap content-between')
      div(v-for="exchange in exchanges", class="w-25 br2 ba dark-gray b--black-10 mb3")
        div(class='bold bg-dark-gray white pa3 tc') {{ exchange.name }}
        div(class='pa3 tc')
          | 0.00
</template>

<script>

import cmApi from '@/cmapi';
const cmApiInst = new cmApi();

export default {
    name: 'spot-price-comparator-view',
    data: () => {
      return {
        selectedCurrencyPair: '',
        exchanges: [],
        products: []
      };
    },
    components: {
    },
    created: function() {
      cmApiInst.getExchanges().then(response => {
        this.exchanges = response;
      });

      cmApiInst.getExchangeProducts().then(response => {
        const currencyPairs = new Set();
        response
          .sort((a,b) => {
            var aName = `${a.base_currency}-${a.quote_currency}`;
            var bName = `${b.base_currency}-${b.quote_currency}`;
            if (aName == bName)
              return 0;
            return aName > bName ? 1 : -1; 
          })
          .map(product => currencyPairs.add(`${product.base_currency}-${product.quote_currency}`));
        this.products = Array.from(currencyPairs);
      });
    },
    destroyed: function(){
      this.selectedCurrencyPair = '';
    },
    methods: {
      loadProduct: function() {
        
      },
      loadOrderbooks: function() {
        if (!this.selectedCurrencyPair)
          return;

        // pull orderbook data from the api 

        setTimeout(() => {

          this.loadOrderbooks();
        }, 5000);
      }
    }
}
</script>