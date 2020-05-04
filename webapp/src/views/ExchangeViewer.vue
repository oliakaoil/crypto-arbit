<template lang="pug">
  div(class='flex flex-wrap justify-between')
    div(class='w-100 mb4 f3')
      | Exchange Stats
    div(class='w-100 mb4 f5')
      | Choose an exchange below. Relevant stats regarding exchange volume, integration and other information will appear below.
    div(class='w-100 mb4 flex')
      div(class='w-30')
        v-select(
            @change='loadExchangeStats($event)', 
            v-model="selectedExchangeOption",
            :options="['--'].concat(exchanges)"          
            )


    div(class='flex mb4 w-100')
        div(class='w-20', v-if='exchange && exchange.id')

            div(class='mb3')
                div(class='b mb2')
                    | Id
                div()
                    | {{ exchange.id }}

            div(class='mb3')
                div(class='b mb2')
                    | Name
                div()
                    | {{ exchange.name }}

            div(class='mb3')
                div(class='b mb2')
                    | Status
                div(v-bind:class="{ green: exchange.status, red:!exchange.status}")
                    | {{ exchange.status ? 'Enabled' : 'Disabled' }}

            div(class='mb3')
                div(class='b mb2')
                    | Engine Type
                div()
                    a(target="_blank", href="https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API", v-if="Number(exchange.localize_type) === 2")
                        | WebSocket
                    a(target="_blank", href="https://restfulapi.net/", v-if="Number(exchange.localize_type) === 1")
                        | REST API

        div(class='w-30', v-if='products.exchangeProducts')

            div(class='mb3')
                div(class='b mb2')
                    | Num Total Products
                div()
                    | {{ products.exchangeProducts.length }}        

            div(class='mb3')
                div(class='b mb2')
                    | Num Arbitrage Products
                div()
                    | {{ products.arbitProducts.length }}

            div(class='mb3')
                div(class='b mb2')
                    | Num Triangle Arbitrage Sets
                div()
                    | {{ products.tarbitSets.length }}                                     

        div(class='w-40', v-if='products.exchangeProducts')

            div(class='mb3')
                div(class='b mb2')
                    | 24hr Total Product Vol USD
                div()
                    | n/a

            div(class='mb3')
                div(class='b mb2')
                    | 24hr Arbitrage Product Vol USD
                div()
                    | {{ stats.arbitProducts24hrUsd | formatNumber }}  


    div(class='flex mb4 w-100', v-if='products.exchangeProducts')
        div(class='w-20')
            div(class='b mb2')
                | Exchange Products
            div(v-for="product in products.exchangeProducts", :key="product.id", class='mb1')
                span()
                    | {{ product.base_currency }}-{{ product.quote_currency }}
        div(class='w-20')
            div(class='b mb2')
                | Arbit Products
            div(v-for="product in products.arbitProducts", :key="product.id", class='mb1')
                span()
                    | {{ product.base_currency }}-{{ product.quote_currency }}

        div(class='w-40')
            div(class='b mb2')
                | Triangle Arbit Sets
            div(v-for="arbitSet in products.tarbitSets", class='mb3')
                div(class='flex items-center')
                    span()
                        | {{ arbitSet.firstLegProduct.base_currency }}-{{ arbitSet.firstLegProduct.quote_currency }}
                    app-icon(icon="arrow-right", class="blue")
                    span()
                        | {{ arbitSet.secondLegProduct.base_currency }}-{{ arbitSet.secondLegProduct.quote_currency }}
                    app-icon(icon="arrow-right", class="blue")
                    span()
                        | {{ arbitSet.thirdLegProduct.base_currency }}-{{ arbitSet.thirdLegProduct.quote_currency }}
</template>

<script>

import cmApi from '@/cmapi';
const cmApiInst = new cmApi();

export default {
    name: 'exchange-viewer-view',
    data: () => {
      return {
        selectedExchangeOption: null,
        selectedExchangeId: 0,
        exchanges: [],
        exchange: {},
        products: {},
        stats: {}
      };
    },
    components: {
    },
    created: function() {
      cmApiInst.getExchanges().then(response => {

        this.exchanges = response
            .filter(exchange => exchange.status)
            .map(exchange => {
                return { label: exchange.name, value: exchange.id };
            });
      });
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
      loadExchangeStats: function() {

        if (!this.selectedExchangeOption)
          return;
        
        this.selectedExchangeId = this.selectedExchangeOption.value;

        cmApiInst.getExchangeStatsById(this.selectedExchangeId).then(response => {
            this.exchange = response.exchange;
            this.products = response.products;
            this.stats = response.stats;

        });

      }
    }
}
</script>

<style lang="scss">

</style>