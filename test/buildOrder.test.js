'use strict';
const {expect} = require('chai');
const {PalantirConnector} = require('../lib/palantir');

describe('buildOrder', () => {
  let palantirConnector;
  let buildOrder;

  before(() => {
    const ds = global.getDataSource();
    const Project = ds.define('Project',
      {
        id: {type: String, id: true, palantir: {primaryKey: true, propertyName: 'project_uid'}},
        title: {type: String, palantir: {unique: true, propertyName: 'project'}},
        objectTypeId: {type: String},
        team: {type: String},
        projectId: {type: Number, palantir: {propertyName: 'project_id'}}
      },
      {
        palantir: {
          objectTypeId: process.env.PALANTIR_OBJECT_TYPE
        }
      });
    const settings = {
      objectType: 'TestType'
    };
    palantirConnector = new PalantirConnector(settings, Project);
    palantirConnector._models = Project.modelBuilder.definitions;
    buildOrder = (order) => palantirConnector.buildOrder('Project', order);
  });

  it('should build sort expression for one sort field and no specified order', () => {
    const sortExpression = buildOrder('title');
    expect(sortExpression).to.eql([{['project.raw']: {order: 'asc'}}]);
  });

  it('should build sort expression for one sort field and specified order', () => {
    const sortExpression = buildOrder('title DESC');
    expect(sortExpression).to.eql([{['project.raw']: {order: 'desc'}}]);
  });

  it('should build sort expression for multiple fields', () => {
    const sortExpression = buildOrder(['title', 'team ASC']);
    expect(sortExpression).to.eql([{['project.raw']: {order: 'asc'}}, {['team.raw']: {order: 'asc'}}]);
  });
});
