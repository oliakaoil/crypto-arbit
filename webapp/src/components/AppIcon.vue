<template lang="pug">
    unicon(:name="icon",class="app-icon dib",width="20",height="20")
</template>


<script>

export default {
  name: 'app-icon',
  props: ['icon']
}

</script>

<style lang="scss">

.disabled {
  svg.app-icon {
    path {
      fill: $dark-gray !important;
    }    
  }
}

.button {
  &.disabled {
    svg.app-icon {
      path {
        fill: $white !important;
      }    
    }
  }
}

svg.app-icon {
    display: inline-block;
    path {
      fill: #fff;
    }

    &.black {
        path {
          fill: $dark-gray;
        }
    }

    &.green {
        path {
          fill: $light-green;
        }
    }

    &.red {
        path {
          fill: $red;
        }
    } 

    &.blue {
        path {
          fill: $hover-blue;
        }
    }    
}

</style>