import Vue from 'vue';
import Vuex from 'vuex';
import { UserModel } from '@/models/user';
import router from './router';
import cmApi from '@/cmapi';
let cmApiInst = new cmApi();

let UserModelInst = new UserModel();

Vue.use(Vuex);

let store = new Vuex.Store({
  state: {
    user: UserModelInst._attributes,
    showSiteAlert: false,
    siteAlert: {
      message: '',
      type: 'info'
    }
  },
  getters: {
    siteAlertIcon: state => {
      switch( state.siteAlert.type ){
        case 'warn': return'exclamation-octagon';
        case 'error': return 'exclamation-octagon';
        default: return 'info-circle';
      }      
    },
    signedIn: state => {
      return (state && state.user && state.user.id ? true : false);
    }
  },
  mutations: {
    siteAlert: ( state , payload ) => {
      state.siteAlert = payload;
      state.showSiteAlert = true;
    },
    clearSiteAlert: ( state ) => {
      state.showSiteAlert = false;
    },
    user: ( state , payload ) => {
      state.user = payload;
    }
  },
  actions: {
    initSession: ( context ) => {
      cmApiInst.getUser().then( res => {
        if( res.id )
          context.dispatch('signIn', res );
      });
    },
    siteAlert: ( context , payload ) => {
      if(!payload.type)
        payload.type = 'warn';
      context.commit('siteAlert', payload);
      setTimeout( () => context.commit('clearSiteAlert') , 8000 );
    },    
    signIn: (context, payload) => {
      context.commit('user', payload);
      context.dispatch('siteAlert',{ message: 'You signed in' , type: 'info' });
    },
    signOut: (context) => {
      cmApiInst.signOut().then( () => {
        context.commit('user',null);
        router.push('/');
        context.dispatch('siteAlert',{ message: 'You were signed out' , type: 'info' });
      });
    }
  }
});

store.subscribe((mutation, state) => {
  localStorage.setItem('store', JSON.stringify(state));
});

export default store;