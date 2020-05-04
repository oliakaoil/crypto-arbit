<template lang="pug">

  div(class="button-nav hvr-icon-bounce clickable white ml4",v-on:click="$emit('click')")
    app-icon(:icon="icon",class="small mr2 hvr-icon dib v-mid")
    span(v-html="label",class="dib v-mid f6 f5-l")


</template>


<script>

export default {
  name: 'button-nav',
  props: ['label','icon']
}

</script>

<style lang="scss">


</style>