'use strict';
const {expect} = require('chai');
const {PalantirConnector} = require('../lib/palantir');

describe('buildWhere', () => {
  let palantirConnector;
  let buildWhere;

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
    buildWhere = (where) => palantirConnector.buildWhere('Project', where);
  });

  it('should build query for simple key-value WHERE filter', () => {
    const query = buildWhere({team: 'Bioprinting'});
    expect(query).to.eql({
      type: 'terms',
      terms: {
        terms: [
          'Bioprinting'
        ],
        field: 'team.raw'
      }
    });
  });

  it('should build query for WHERE filter containing "and"', () => {
    const query = buildWhere({
      and: [
        {team: 'Bioprinting'},
        {title: 'Test Title 1'}
      ]
    });
    expect(query).to.eql({
      type: 'and',
      and: [
        {
          type: 'terms',
          terms: {
            terms: ['Bioprinting'],
            field: 'team.raw'
          }
        },
        {
          type: 'terms',
          terms: {
            terms: ['Test Title 1'],
            field: 'project.raw'
          }
        }
      ]
    });
  });

  it('should build query for WHERE filter containing nested "and" and "or"', () => {
    const query = buildWhere({
      and: [
        {team: 'Bioprinting'},
        {or: [{title: 'Test Title 1'}, {title: 'Test Title 2'}]}
      ]
    });
    expect(query).to.eql({
      type: 'and',
      and: [{
        type: 'terms',
        terms: {
          terms: ['Bioprinting'],
          field: 'team.raw'
        }
      }, {
        type: 'or',
        or: [{
          type: 'terms',
          terms: {
            terms: ['Test Title 1'],
            field: 'project.raw'
          }
        }, {
          type: 'terms',
          terms: {
            terms: ['Test Title 2'],
            field: 'project.raw'
          }
        }]
      }]
    });
  });

  it('should build query for WHERE filter with "inq" operator', () => {
    const query = buildWhere({title: {inq: ['Project 1', 'Project 2']}});
    expect(query).to.eql({
      type: 'terms',
      terms: {
        terms: [
          'Project 1',
          'Project 2'
        ],
        field: 'project.raw'
      }
    });
  });

  it('should build query for WHERE filter with "neq" operator', () => {
    const query = buildWhere({title: {neq: 'Project1'}});
    expect(query).to.eql({
      type: 'not',
      not: {
        type: 'terms',
        terms: {
          terms: ['Project1'],
          field: 'project.raw'
        }
      }
    });
  });

  it('should build query for WHERE filter with "like" operator', () => {
    const query = buildWhere({title: {like: 'Project*'}});
    expect(query).to.eql({
      type: 'wildcard',
      wildcard: {
        field: 'project.raw',
        value: 'Project*'
      }
    });
  });
});

