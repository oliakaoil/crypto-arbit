
import CMModel from '@/models/cmmodel';

import {
    required,
    string,
    not
} from 'vue-mc/validation';

class UserModel extends CMModel {

  options() {
    return {
      identifier: 'id'
    };
  }

  // Default attributes that define the "empty" state.
  defaults() {
    return {
      first_name: '',
      last_name: '',
      email: ''
    }
  }

  mutations() {
    return {
      id: (val) => Number(val),
      first_name: (val) => String(val),
      last_name: (val) => String(val),
      email: (val) => String(val)
    }
  }

  // Attribute validation
  validation() {
    return {
      first_name: string.and(required).and(not('')),
      email: string.and(required).and(not(''))
    }
  }

  // Route configuration
  routes() {
    return {
      fetch: '/user/{id}',
      save:  '/user',
      update: '/user/{id}',
      delete: '/user/{id}'
    }
  }
}

export { UserModel };