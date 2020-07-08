'use strict';
const _ = require('lodash');
const debug = require('debug')('loopback:connector:palantir');

function buildWhere(modelName, where) {
  const self = this;
  const model = self._models[modelName];
  const filter = {};
  const keys = Object.keys(where);
  // Simple condition with only 1 property
  if (keys.length === 1 && model.properties.hasOwnProperty(keys[0])) {
    filter.type = 'terms';
    const palantirField = self.getPalantirPropertyName(modelName, keys[0]);
    filter.terms = {terms: [where[keys[0]]], field: `${palantirField}.raw`};
  }
  return filter;
}

module.exports.buildWhere = buildWhere;
