<template lang="pug">
  div(class="modal")
    div(class='header')
      | Sign In
    div(class='mb4')
      | Please use the form below to sign in.
    vue-form(:state="formstate" @submit.prevent="onSubmit")
      div(class='mb4')
        validate
          label(class='db mb1')
            | E-mail address
          input(type='text',v-model='model.email', name='email', required, class='dib w-60',v-focus)

          field-messages(name="email",show="$submitted",class="field-messages")
            div(slot="required",class="form-error")
              | Please enter a valid e-mail address        
      div(class='mb4')
        validate
          label(class='db mb1')
            | Password
          input(type='password',v-model='model.password', name='password', required, class='dib w-60')

          field-messages(name='password',show='$submitted',class='field-messages')
            div(slot='required',class='form-error')
              | Please enter your password
      div(class='mb4 flex items-center')
        div(class='flex-grow-0')
          button(type='submit',class='button')
            app-icon(icon="entry")
            | Sign In
        div(class='flex-grow-1')
          span(v-html='errorMessage',class='dib red ml3')

    button-modal-close(:modalName='modalName')
</template>

<script>

import buttonModalClose from '@/components/ButtonModalClose';
import cmApi from '@/cmapi';

export default {
  components: {
    buttonModalClose
  },
  data: () => {
    return {
      modalName: 'user-signin-modal',
      formstate: {},
      errorMessage: '',
      model: {
        email: '',
        password: ''
      }      
    }
  },
  methods: {
    onSubmit: function() {

      this.errorMessage = '';

      if(this.formstate.$invalid)
        return;
      
      (new cmApi()).signIn(this.model.email , this.model.password).then( res => {

        if (!res) {
          this.errorMessage = 'Something went wrong...? :-)';
          return;
        }

        if (res.error) {
          this.errorMessage = res.error;
          return;
        }

        this.$modal.hide( this.modalName );
        this.$store.dispatch('signIn', res);
        this.$router.push('/dashboard');
      });
    }
  }

}
</script>