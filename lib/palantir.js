'use strict';
const {Connector} = require('loopback-connector');
const debug = require('debug')('loopback:connector:palantir');
const util = require('util');
const axios = require('axios').default;
const _ = require('lodash');
const md5 = require('md5');

const PALANTIR_PATHS = {
  objectSearch: '/objects/search/objects',
  objectStorage: '/storage/edits/events/objects',
  objectLocator: '/storage/edits/events/objectLocator',
  getObjectByLocator: '/storage/load/objectsByLocator'
};

const standardProperties = [
  'objectRid',
  'objectTypeId',
  'title',
  'properties',
  'primaryKey',
  'baseVersion',
  'editsVersion',
  'workstateEditsVersion'
];

function PalantirConnector(settings, dataSource) {
  Connector.call(this, 'palantir', settings);
  this.debug = settings.debug || debug.enabled;
  if (this.debug) {
    debug('Settings %j', settings);
  }
  this.dataSource = dataSource;
  this._models = this._models || this.dataSource.modelBuilder.definitions;
  axios.defaults.baseURL = settings.serviceUrl;
  axios.defaults.timeout = settings.timeout || 2000;
  axios.defaults.headers['Authorization'] = `Bearer ${settings.apiToken}`;
  console.log('AXIOS defaults: ' + JSON.stringify(axios.defaults));
}

util.inherits(PalantirConnector, Connector);

/**
 * Connect to Palantir
 * @param {Function} [callback] The callback function
 *
 * @callback callback
 * @param {Error} err The error object
 * @param {Sp} db The sharepoint object
 */
PalantirConnector.prototype.connect = function(callback) {
  callback();
};

exports.initialize = function initializeDataSource(dataSource, callback) {
  const settings = dataSource.settings;
  dataSource.connector = new PalantirConnector(settings, dataSource);
  if (callback) {
    dataSource.connector.connect(callback);
  }
};

PalantirConnector.prototype.create = function(modelName, data, options, callback) {
  debug('create', modelName, data);
  const pkPropertyName = this.getPrimaryKey(modelName);
  const uniquePropName = this.getUniquePropertyName(modelName);
  const pkPropertyValue = md5(standardizeName(data[uniquePropName]));
  const palantirProperties = this.toPalantirProperties(modelName, data);
  const body = {
    locator: {
      typeId: this.settings.objectType,
      primaryKey: {
        [pkPropertyName]: pkPropertyValue
      }
    },
    request: {
      customMetadata: {}, payload: {
        type: 'objectAdded',
        objectAdded: {
          properties: palantirProperties
        }
      }
    }
  };

  axios.post(PALANTIR_PATHS.objectLocator, body)
    .then((response) => {
      callback(null, pkPropertyValue);
    })
    .catch(err => {
      callback(err);
    });
};

PalantirConnector.prototype.all = function(modelName, filter, options, callback) {
  const id = _.get(filter, 'where.id');
  // get by id
  if (id) {
    const pkPropertyName = this.getPrimaryKey(modelName);
    const body = {
      typeId: this.settings.objectType,
      primaryKey: {
        [pkPropertyName]: id
      }
    };
    axios.post(PALANTIR_PATHS.getObjectByLocator, body)
      .then((response) => {
        const lbItem = this.toLbModelInstance(modelName, response.data);
        callback(null, [lbItem]);
      })
      .catch(err => {
        callback(err);
      });
  }
};

/**
 * Deletes matching objects in Palantir data store
 * @param {String} modelName The model name
 * @param {Object} [where] The filter for where
 * @param {Function} [callback] The callback function
 */
PalantirConnector.prototype.destroyAll = function(modelName, where, options, callback) {
  debug('delete', modelName, where);
  const id = _.get(where, 'id');
  if (id) {
    const pkPropertyName = this.getPrimaryKey(modelName);
    const body = {
      locator: {
        typeId: this.settings.objectType,
        primaryKey: {
          [pkPropertyName]: id
        }
      },
      request: {
        customMetadata: {}, payload: {
          type: 'objectDeleted',
          objectDeleted: {}
        }
      }
    };

    axios.post(PALANTIR_PATHS.objectLocator, body)
      .then((response) => {
        callback();
      })
      .catch(err => {
        callback(err);
      });
  }
};

function standardizeName(name) {
  return name.toLowerCase()
    .replace('ncgca', '')
    .trim()
    .replace(/ /g, '_');
}

/*!
 * Gets the name of primary key  list column name for specified LB model property
 *
 * @param {Object} modelInfo The model definition
 * @param {String} propName Property name
 */
PalantirConnector.prototype.getPrimaryKey = function(modelName) {
  const modelInfo = this._models[modelName];
  const pkPropertyKey = _.findKey(modelInfo.properties, (prop) => prop.palantir.primaryKey);
  return _.get(modelInfo.properties[pkPropertyKey], 'palantir.propertyName') || pkPropertyKey;
};

/*!
 * Gets the Palantir list column name for specified LB model property
 *
 * @param {Object} modelInfo The model definition
 * @param {String} propName Property name
 */
PalantirConnector.prototype.getIdPropertyName = function(modelName) {
  const modelInfo = this._models[modelName];
  for (const propName in modelInfo.properties) {
    if (modelInfo.properties[propName].id) {
      return propName;
    }
  }
};

PalantirConnector.prototype.getUniquePropertyName = function(modelName) {
  const modelInfo = this._models[modelName];
  for (const propName in modelInfo.properties) {
    if (_.get(modelInfo.properties[propName], 'palantir.unique')) {
      return propName;
    }
  }
};

PalantirConnector.prototype.getPalantirPropertyName = function(modelName, modelProperty) {
  const modelInfo = this._models[modelName];
  return _.get(modelInfo.properties, `${modelProperty}.palantir.propertyName`) || modelProperty;
};

PalantirConnector.prototype.toPalantirProperties = function(modelName, data) {
  const palantirProperties = _.mapKeys(data, (value, key) => {
    return this.getPalantirPropertyName(modelName, key);
  });
  return Object.assign(_.omit(palantirProperties, standardProperties), {policy: this.settings.policy});
};

PalantirConnector.prototype.toLbModelInstance = function(modelName, palantirObject) {
  if (!palantirObject) {
    return null;
  }
  const lbEntity = {};
  const modelInfo = this._models[modelName];
  const idPropName = this.getIdPropertyName(modelName);
  for (const lbPropName in modelInfo.properties) {
    const palantirPropName = this.getPalantirPropertyName(modelName, lbPropName);
    if (lbPropName === idPropName) {
      lbEntity[lbPropName] = palantirObject.primaryKey[palantirPropName];
    } else if (standardProperties.includes(palantirPropName)) {
      lbEntity[lbPropName] = palantirObject[palantirPropName];
    } else {
      lbEntity[lbPropName] = _.get(palantirObject, `properties.${palantirPropName}`);
    }
  }
  return lbEntity;
};

exports.PalantirConnector = PalantirConnector;
