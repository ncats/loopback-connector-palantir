'use strict';
const _ = require('lodash');

function buildWhere(modelName, where) {
  if (_.isEmpty(where)) {
    return {type: 'matchAll', matchAll: {}};
  }
  const self = this;
  const model = self._models[modelName];
  const filter = {};
  const keys = Object.keys(where);
  if (keys.length === 1 && model.properties.hasOwnProperty(keys[0]) && !_.isObject(where[keys[0]])) {
    // Simple WHERE filter with single property-value match. Example: where = {property: value}
    filter.type = 'terms';
    const palantirField = self.getPalantirPropertyName(modelName, keys[0]);
    filter.terms = {terms: [where[keys[0]]], field: `${palantirField}.raw`};
  } else if (keys.length === 1 && model.properties.hasOwnProperty(keys[0]) && _.isObject(where[keys[0]])) {
    // WHERE filter with and expression. Example: where = {property: {neq: value}}
    const palantirField = self.getPalantirPropertyName(modelName, keys[0]);
    const expression = where[keys[0]];
    const operator = Object.keys(expression)[0];
    const subExpression = expression[operator];
    switch (operator) {
      case 'neq':
        filter.type = 'not';
        filter.not = {type: 'terms', terms: {terms: [subExpression], field: `${palantirField}.raw`}};
        break;
      case 'inq':
        filter.type = 'terms';
        filter.terms = {terms: subExpression, field: `${palantirField}.raw`};
        break;
      case 'like':
        filter.type = 'wildcard';
        filter.wildcard = {field: `${palantirField}.raw`, value: subExpression};
        break;
      default:
        throw new Error(`'${operator}' operator is not supported.`);
    }
  } else if (keys.length === 1 && (keys[0] === 'and' || keys[0] === 'or')) {
    // WHERE filter with AND or OR operators. Example: where = {or: [{property1: value1}, {property2: value2}]}
    const logicalOperator = keys[0];
    filter.type = logicalOperator;
    const innerFilters = _.map(where[logicalOperator], lbCondition => buildWhere.call(self, modelName, lbCondition));
    filter[logicalOperator] = innerFilters;
  }
  return filter;
}

module.exports.buildWhere = buildWhere;
