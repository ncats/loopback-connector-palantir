'use strict';
const _ = require('lodash');

function buildOrder(modelName, order) {
  const self = this;
  if (_.isArray(order)) {
    return _.map(order, (sortExpression) => toPalantirSortExpression.call(self, modelName, sortExpression));
  } else {
    return [toPalantirSortExpression.call(self, modelName, order)];
  }
}

function toPalantirSortExpression(modelName, lbSortExpression) {
  const parts = lbSortExpression.split(' ');
  const palantirProperty = `${this.getPalantirPropertyName(modelName, parts[0])}.raw`;
  if (parts.length === 1) {
    return {[palantirProperty]: {order: 'asc'}};
  } else if (parts[1].toLowerCase() === 'desc') {
    return {[palantirProperty]: {order: 'desc'}};
  } else {
    return {[palantirProperty]: {order: 'asc'}};
  }
}
module.exports.buildOrder = buildOrder;
