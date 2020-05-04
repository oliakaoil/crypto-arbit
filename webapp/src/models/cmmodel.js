
import {Model} from 'vue-mc';
import _ from 'lodash';
import cmApi from '@/cmapi';

let cmApiInst = new cmApi();

export default class CCModel extends Model {

  getDefaultMethods(){
    return {
      "fetch": "GET",
      "save": "POST",
      "update": "PUT",
      "create": "POST",
      "patch": "PATCH",
      "delete": "DELETE",
    }
  }
  
  getDefaultHeaders() {
    return {
      'Authorization': cmApiInst.getAuthHeader()
    }
  }    

  getRouteResolver() {

    var self = this;

    return function (route) {
        let parameters = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        let replacements = self.getRouteReplacements(route, parameters);

        // Replace all route parameters with their replacement values.
        var uri = _.reduce(replacements, function (result, value, parameter) {
            return _.replace(result, parameter, value);
        }, route);

        return cmApiInst.getBaseUrl() + uri;
    };    
  }
}