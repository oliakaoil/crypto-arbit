<template lang="pug">

  div(id="app",class="p0 m0 flex flex-column h-100")

    nav(class="pb1 w-100 bb bc-gray bw-3 flex-grow-0")
      div(class="w-90 center flex")

        div(class='w-50 flex items-end')
          router-link(:to='$store.getters.signedIn ? "/dashboard" :"/"', class='white no-hover')
            | CryptoMac

          span(v-if='$store.getters.signedIn')
            router-link(, to='/dashboard', class='white no-hover f6 ml3')
              | Home

            router-link(to='/orderbook-viewer', class='white no-hover f6 ml3')
              | Orderbook Engine

            router-link(to='/exchange-stats', class='white no-hover f6 ml3')
              | Exchange Stats

            router-link(to='/tarbit-list', class='white no-hover f6 ml3')
              | Tarbit List

        div(class='w-50 flex items-end justify-end')            
          button-nav(
            :label="$store.state.user.first_name",
            icon='user',
            v-if="$store.getters.signedIn"
            )

          button-nav(
            label='Sign In',
            icon='entry',
            v-if="!$store.getters.signedIn",
            v-on:click="openUserSignInModal()"
            )

    main(class="pt5 pb4 flex-grow-1")
      div(class="w-90 center h-95")
        router-view(class="router-view")

    footer(class="bt bc-gray mt3 flex-grow-0")

      div(class="w-90 center flex items-center justify-between pt3 pb3")

        div()
          span(class='f6') {{ utcDate }}
          span(class='f7') Z      
          span(class='f6 ml2')
            | Orderbook Engine Status: 
          span(v-bind:class='{ green: orderbookEngineStatus === "online"}')
            | {{ orderbookEngineStatus }}

        div(class="clickable hover-opacity",v-if="$store.getters.signedIn",v-on:click="$store.dispatch('signOut')")
          | Sign Out

    transition(enter-active-class="animated fadeInUp", leave-active-class="animated fadeOutDown")
      div(
        id="site-alert",
        class="flex clickable items-center pa2 pl3 pr3",
        v-if="showSiteAlert",
        v-on:click="$store.commit('clearSiteAlert')" 
        v-bind:class="$store.state.siteAlert.type",
        )
        app-icon(
          v-bind:icon="$store.getters.siteAlertIcon",
          class="db flex-grow-0 mr3 medium"
          )
        div(class="flex-grow-1 f6", v-html="$store.state.siteAlert.message")

</template>


<script>

import buttonNav from '@/components/ButtonNav';
import modalUserSignIn from '@/components/modals/ModalUserSignIn';
import * as moment from 'moment';

import cmApi from '@/cmapi';
const cmApiInst = new cmApi();

export default {
  name: 'app',
  components: {
    modalUserSignIn,
    buttonNav
  },
  data: function(){
      return {
          utcDate: '',
          orderbookEngineStatus: 'unknown'
      };
  },
  computed: {
    showSiteAlert: function() {
      return this.$store.state.showSiteAlert;
    }
  },
  methods: {
    updateUtcTime: function(){
      this.utcDate = moment.utc().format('YYYY-MM-DD HH:mm:ss');
    },
    openUserSignInModal: function() {
      this.$modal.show( modalUserSignIn , {}, { height: 'auto', name: 'user-signin-modal', adaptive: true });
    },
    testApi: () => cmApi.ping() //.then( r => console.log( r ) )
  },
  mounted: function(){
    setInterval( this.updateUtcTime, 1000 );

    cmApiInst.getOrderbookEngineStats().then(response => {
      this.orderbookEngineStatus = response.status;
    });
  }
}
</script>

<style lang="scss">

body {
  overflow: hidden;
}

nav {
  display: block;
  color: $white;
  background-color: $dark-green;
  padding-top: 1.3em;

  .button-nav:nth-child(1) {
    margin-left: 0 !important;
  }
}

main {
  overflow-y: scroll;
}

#site-alert {
  position: fixed;
  bottom: 65px;
  right: 30px;
  max-width: 50%;
  line-height: 140%;

  &.info {
    background-color: $hover-blue;
    color: $white;
  }

  &.warn {
    background-color: $warn-gold;
    color: $white;
  }  
  &.error {
    background-color: $error-red;
    color: $white;
  }    
}

</style>