module.exports = {
  css: {
    loaderOptions: {
      sass: {
        data: `
          @import "@/sass/style.scss";
        `
      }
    }
  },

  configureWebpack: {
    devServer: {
      disableHostCheck: true,
      proxy: {
          '/api': {
            target: 'http://192.168.50.14:8091',
            secure: false
          }
      }      
    }
  }
}
