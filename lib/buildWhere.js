'use strict';
const _ = require('lodash');
const debug = require('debug')('loopback:connector:palantir');

function buildWhere(modelName, where) {
  const self = this;
  const model = self._models[modelName];
  const filter = {};
  const keys = Object.keys(where);
  if (keys.length === 1 && model.properties.hasOwnProperty(keys[0])) {
    // Simple condition with only 1 property
    filter.type = 'terms';
    const palantirField = self.getPalantirPropertyName(modelName, keys[0]);
    filter.terms = {terms: [where[keys[0]]], field: `${palantirField}.raw`};
  } else if (keys.length === 1 && (keys[0] === 'and' || keys[0] === 'or')) {
    // a logical condition with collection AND or OR
    const logicalOperator = keys[0];
    filter.type = logicalOperator;
    const innerFilters = _.map(where[logicalOperator], lbCondition => buildWhere.call(self, modelName, lbCondition));
    filter[logicalOperator] = innerFilters;
  }
  return filter;
}

module.exports.buildWhere = buildWhere;
