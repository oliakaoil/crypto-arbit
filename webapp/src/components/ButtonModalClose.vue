<template lang="pug">
  div(id='modal-close-button',class='blue clickable', v-on:click="$modal.hide(modalName)")
    app-icon(icon="times-square",class="mr1 medium blue")

</template>


<script>

export default {
  name: 'modal-close-button',
  props: ['modalName']
}
</script>