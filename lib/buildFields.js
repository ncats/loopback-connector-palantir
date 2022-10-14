'use strict';
const _ = require('lodash');

function buildFields(modelName, fieldsFilter) {
  return _.map(fieldsFilter, prop => this.getPalantirPropertyName(modelName, prop));
}

module.exports.buildFields = buildFields;
