import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import moment from 'moment-timezone';
import VueMoment from 'vue-moment';
import vSelect from 'vue-select';
import VModal from 'vue-js-modal';''
import VueForm from 'vue-form';
import VueTagsInput from '@johmun/vue-tags-input';
import Unicon from 'vue-unicons';
import AppIcon from '@/components/AppIcon';
import axios from 'axios';
import numeral from 'numeral';

import VueGoodTablePlugin from 'vue-good-table';
import 'vue-good-table/dist/vue-good-table.css';


import {
  uniExternalLinkAlt, 
  uniChartLine,
  uniRefresh,
  uniToggleOn,
  uniToggleOff,
  uniClipboardNotes,
  uniEdit, 
  uniPlusCircle, 
  uniTimesSquare,
  uniCheckCircle,
  uniSort,
  uniCornerUpRight,
  uniCornerUpLeft,
  uniTrashAlt,
  uniFileCheck,
  uniShareAlt,
  uniInfoCircle,
  uniExclamationOctagon,
  uniExit,
  uniEntry,
  uniUser,
  uniUserPlus,
  uniFolder,
  uniQuestionCircle,
  uniMessage,
  uniEnter,
  uniPlus,
  uniArrowRight
 } from 'vue-unicons/src/icons';

Unicon.add([
  uniExternalLinkAlt,
  uniChartLine,
  uniRefresh,
  uniToggleOn,
  uniToggleOff,  
  uniClipboardNotes,
  uniEdit, 
  uniPlusCircle, 
  uniTimesSquare,
  uniCheckCircle,
  uniSort,
  uniCornerUpRight,
  uniCornerUpLeft,
  uniTrashAlt,
  uniFileCheck,
  uniShareAlt,
  uniInfoCircle,
  uniExclamationOctagon,
  uniExit,
  uniEntry,
  uniUser,
  uniUserPlus,
  uniFolder,
  uniQuestionCircle,
  uniPlus,
  uniMessage,
  uniEnter,
  uniArrowRight
]);
Vue.use(Unicon);

Vue.component('app-icon', AppIcon);


Vue.use(VueGoodTablePlugin);

Vue.use(VModal, { 
  dynamic: true, 
  injectModalsContainer: true, 
  draggable: false
});

Vue.use(VueMoment, { moment });

Vue.use(VueTagsInput);

Vue.use(VueForm,{
  inputClasses: {
    valid: 'form-valid',
    invalid: 'form-invalid'
  },
  validators: {
    matches: (value, attrValue) => ( attrValue && value === attrValue )
  }  
});

Vue.component('v-select', vSelect);

// https://stackoverflow.com/questions/34941829/setting-focus-of-an-input-element-in-vue-js
Vue.directive('focus', {
  inserted: (el) => {
    el.focus()
  }
});

Vue.filter('toFixed4', function (value) {
  if (!value) return ''
  return String(Number(value).toFixed(4));
});

Vue.filter("formatNumber", function (value) {
  return numeral(value).format("0,0");
});

Vue.directive('onEnterKey', {
  inserted: (el, handler) => {
    el.addEventListener('keyup', (e) => {
      let keycode = (e.keyCode ? e.keyCode : e.which);
      if( keycode === 13 )
        handler.value.apply( null, el );
    });
  }
});

Vue.config.productionTip = false;
axios.defaults.withCredentials = true;

new Vue({
  router,
  store,
  render: h => h(App),
  beforeCreate: function() {
    this.$store.dispatch('initSession');  
  }
}).$mount('#app');