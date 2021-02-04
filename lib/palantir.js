'use strict';
const {Connector} = require('loopback-connector');
const debug = require('debug')('loopback:connector:palantir');
const util = require('util');
const axios = require('axios').default;
const _ = require('lodash');
const md5 = require('md5');
const {buildWhere} = require('./buildWhere');
const {buildFields} = require('./buildFields');
const {buildOrder} = require('./buildOrder');

const PALANTIR_PATHS = {
  objectSearch: '/objects/search/objects',
  objectStorage: '/storage/edits/events/objects',
  objectLocator: '/storage/edits/events/objectLocator',
  objectLocators: '/storage/edits/bulk/events/objectLocators',
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
  this._models = this.dataSource.modelBuilder.definitions;
  axios.defaults.baseURL = settings.serviceUrl;
  axios.defaults.timeout = settings.timeout || 2000;
  axios.defaults.headers['Authorization'] = `Bearer ${settings.apiToken}`;
}

util.inherits(PalantirConnector, Connector);

/**
 * Connect to Palantir
 * @param {Function} [callback] The callback function
 *
 * @callback callback
 * @param {Error} err The error object
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
  const props = this.toPalantirProperties(modelName, data);
  const palantirProperties = options.noPolicy ? props : Object.assign(
    props,
    {policy: this.settings.policy}
  );
  const body = {
    locator: {
      typeId: options.objectTypeId || this.settings.objectType,
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
  debug('all', modelName, filter);
  const id = _.get(filter, 'where.id');
  if (id) { // get single object by id
    debug('get object by id');
    const pkPropertyName = this.getPrimaryKey(modelName);
    const body = {
      typeId: options.objectTypeId || this.settings.objectType,
      primaryKey: {
        [pkPropertyName]: id
      }
    };
    const url = PALANTIR_PATHS.getObjectByLocator;
    debug('request: ', 'POST', url, body);
    axios.post(url, body)
      .then((response) => {
        const lbItem = this.toLbModelInstance(modelName, response.data);
        callback(null, [lbItem]);
      })
      .catch(err => {
        callback(err);
      });
  } else { // search objects by filter
    const pageSize = options && options.pageSize >= 0 ? options.pageSize : 10000;
    const url = `${PALANTIR_PATHS.objectSearch}?pageSize=${pageSize}`;
    const body = {
      objectTypes: [options.objectTypeId || this.settings.objectType],
      filter: this.buildWhere(modelName, filter.where)
    };

    const properties = this.buildFields(modelName, filter.fields);
    if (!_.isEmpty(properties)) {
      body.propertySelector = {propertyWhitelist: properties};
    }
    if (!_.isEmpty(filter.order)) {
      body.sort = this.buildOrder(modelName, filter.order);
    }
    debug('request: ', 'POST', url, body);
    axios.post(url, body)
      .then((response) => {
        const lbItems = _.map(response.data.hits, (hit) => { return this.toLbModelInstance(modelName, hit.object, properties); });
        callback(null, lbItems);
      })
      .catch(err => {
        callback(err);
      });
  }
};

/**
 * Count the number of objects for the given model
 *
 * @param {String} modelName The model name
 * @param {Function} [callback] The callback function
 * @param {Object} where The where filter
 *
 */
PalantirConnector.prototype.count = function count(
  modelName,
  where,
  options,
  callback
) {
  debug('count', modelName, where);
  const body = {objectTypes: [options.objectTypeId || this.settings.objectType]};
  body.filter = this.buildWhere(modelName, where);
  const url = `${PALANTIR_PATHS.objectSearch}?pageSize=0`;
  debug('request: ', 'POST', url, body);
  axios.post(url, body)
    .then((response) => {
      callback(null, {count: response.data.totalHits});
    })
    .catch(err => {
      callback(err);
    });
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
  const pkPropertyName = this.getPrimaryKey(modelName);
  if (id) {
    const body = {
      locator: {
        typeId: options.objectTypeId || this.settings.objectType,
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
      .then(() => {
        callback(null, {count: 1});
      })
      .catch(err => {
        callback(err);
      });
  } else {
    this.all(modelName, {where}, options, (err, results) => {
      const body = _.map(results, (result) => {
        return {
          locator: {
            typeId: options.objectTypeId || this.settings.objectType,
            primaryKey: {
              [pkPropertyName]: result.id
            }
          },
          request: {
            customMetadata: {}, payload: {
              type: 'objectDeleted',
              objectDeleted: {}
            }
          }
        };
      });
      axios.post(PALANTIR_PATHS.objectLocators, body)
        .then((response) => {
          callback(null, {count: results.length});
        })
        .catch(err => {
          callback(err);
        });
    });
  }
};

/**
 * Replace properties for the model instance data
 * @param {String} modelName The model name
 * @param {*} id The instance id
 * @param {Object} data The model data
 * @param {Object} options The options object
 * @param {Function} [callback] The callback function
 */
PalantirConnector.prototype.replaceById = function replace(
  modelName,
  id,
  data,
  options,
  callback
) {
  debug('replace', modelName, id, data);
  const pkPropertyName = this.getPrimaryKey(modelName);
  const palantirProperties = _.omit(this.toPalantirProperties(modelName, data), pkPropertyName);
  const body = {
    locator: {
      typeId: options.objectTypeId || this.settings.objectType,
      primaryKey: {
        [pkPropertyName]: id
      }
    },
    request: {
      customMetadata: {}, payload: {
        type: 'objectModified',
        objectModified: {
          properties: palantirProperties
        }
      }
    }
  };
  axios.post(PALANTIR_PATHS.objectLocator, body)
    .then((response) => {
      callback(null, id);
    })
    .catch(err => {
      callback(err);
    });
};

/**
 * Update all matching instances
 * @param {String} modelName The model name
 * @param {Object} where The search criteria
 * @param {Object} data The property/value pairs to be updated
 * @callback {Function} cb Callback function
 */
PalantirConnector.prototype.update = PalantirConnector.prototype.updateAll = function updateAll(
  modelName,
  where,
  data,
  options,
  callback
) {
  const pkPropertyName = this.getPrimaryKey(modelName);
  const palantirProperties = _.omit(this.toPalantirProperties(modelName, data), pkPropertyName);
  this.all(modelName, {where}, options, (err, results) => {
    const body = _.map(results, (result) => {
      return {
        locator: {
          typeId: options.objectTypeId || this.settings.objectType,
          primaryKey: {
            [pkPropertyName]: result.id
          }
        },
        request: {
          customMetadata: {}, payload: {
            type: 'objectModified',
            objectModified: {
              properties: palantirProperties
            }
          }
        }
      };
    });
    axios.post(PALANTIR_PATHS.objectLocators, body)
      .then((response) => {
        callback(null, {count: results.length});
      })
      .catch(err => {
        callback(err);
      });
  });
};

function standardizeName(name) {
  return _.toString(name).toLowerCase()
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

/**
 * Gets the active Palantir columns for specified LB model
 * @param {String} modelName The model name
 * @param {Object} data The model data
 */
PalantirConnector.prototype.getActiveProperties = function(modelName, data) {
  const properties = _.get(this._models[modelName], 'properties', {});
  const activePropertyNames = _.keys(data).filter((key) => !_.get(properties, `${key}.palantir.ignore`));
  return _.pick(data, activePropertyNames);
};

PalantirConnector.prototype.toPalantirProperties = function(modelName, data) {
  const activeProperties = this.getActiveProperties(modelName, data);
  const palantirProperties = _.mapKeys(activeProperties, (_, key) => {
    return this.getPalantirPropertyName(modelName, key);
  });
  return _.omit(palantirProperties, standardProperties);
};

PalantirConnector.prototype.toLbModelInstance = function(modelName, palantirObject, properties) {
  if (!palantirObject) {
    return null;
  }
  const lbEntity = {};
  const modelInfo = this._models[modelName];
  const idPropName = this.getIdPropertyName(modelName);
  for (const lbPropName in modelInfo.properties) {
    const palantirPropName = this.getPalantirPropertyName(modelName, lbPropName);
    if (!_.isEmpty(properties) && !_.includes(properties, palantirPropName)) {
      continue;
    }
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

PalantirConnector.prototype.buildWhere = buildWhere;
PalantirConnector.prototype.buildFields = buildFields;
PalantirConnector.prototype.buildOrder = buildOrder;

exports.PalantirConnector = PalantirConnector;
