<template lang="pug">
  div(id="router-view-page-not-found")
    div(class='f3 b')
        | Page not found
    div(class='mt5')
        | Hmmm..we can't seem to find this page. Would you like to 
        |
        router-link(to="/")
            | head on home
        | ?
      
</template>


<script>


export default {
  name: 'page-not-found',
  components: {
  }
}
</script>