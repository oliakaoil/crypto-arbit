<template lang="pug">
  div(class='flex flex-wrap justify-between')
    div(class='w-100 mb4 f3')
      | Triangle Arbits
    div(class='w-100 mb4 f5')
      | 
    div(class='w-100 mb4 flex')
        vue-good-table(
            :columns="columns" 
            :rows="tarbits" 
            :row-style-class="rowStyleClassFn"
            )


</template>

<script>

import cmApi from '@/cmapi';
const cmApiInst = new cmApi();

export default {
    name: 'tarbit-list-view',
    data: () => {
      return {
          columns: [
              {label: 'Id', field: 'id'},
              {label: 'Exchange Id', field: 'exchange_id'},
              {
                  type: 'date',
                  label: 'Date', 
                  field: 'created_at', 
                  dateInputFormat: 'yyyy-MM-dd HH:mm:ss', // 2019-11-16T23:48:27.000Z
                  dateOutputFormat: 'dd-MMM-yy HH:mm:ss'
              },
              {label: 'Est Net', field: 'est_net'},
              {label: 'Quote Currency', field: 'quote_currency'},
              {label: 'Pair 1', field: 'currency_pair1'},
              {label: 'Pair 2', field: 'currency_pair2'},
              {label: 'Pair 3', field: 'currency_pair3'}

          ],
          tarbits: []
      };
    },
    components: {
    },
    created: function() {
      cmApiInst.getTarbits().then(response => {

        this.tarbits = response;
      });
    },
 
    methods: {
    }
}
</script>

<style lang="scss">

table.vgt-table {

    tr:nth-child(even) {
      background-color: $light-gray;
    }    
}

</style>