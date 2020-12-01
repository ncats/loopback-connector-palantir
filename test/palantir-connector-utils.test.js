'use strict';
const {expect} = require('chai');
const {PalantirConnector} = require('../lib/palantir');

describe('Palantir connector utility methods', () => {
  let palantirConnector;

  const settings = {
    objectType: 'Project'
  };

  before(() => {
    const ds = global.getDataSource();
    const Project = ds.define('Project',
      {
        id: {type: String, id: true, palantir: {primaryKey: true, propertyName: 'project_uid'}},
        title: {type: String, palantir: {unique: true, propertyName: 'project'}},
        objectTypeId: {type: String},
        team: {type: String},
        projectId: {type: Number, palantir: {propertyName: 'project_id'}},
        testProp: {type: String, palantir: {ignore: true, propertyName: 'test_prop'}}
      },
      {
        palantir: {
          objectTypeId: process.env.PALANTIR_OBJECT_TYPE
        }
      });
    palantirConnector = new PalantirConnector(settings, Project);
    palantirConnector._models = Project.modelBuilder.definitions;
  });

  describe('getActiveProperties', () => {
    it('should return an empty object for empty data', () => {
      const data = {};
      const properties = palantirConnector.getActiveProperties(settings.objectType, data);
      expect(properties).to.eql({});
    });

    it('should return an empty object for missing data', () => {
      const properties = palantirConnector.getActiveProperties(settings.objectType, undefined);
      expect(properties).to.eql({});
    });

    it('should return an empty object for missing modelName and missing data', () => {
      const properties = palantirConnector.getActiveProperties(undefined, undefined);
      expect(properties).to.eql({});
    });

    it('should return the original data object for missing modelName and valid data', () => {
      const data = {
        id: 'test',
        title: 'test',
        objectTypeId: 'test',
        team: 'test',
        projectId: 0,
        testProp: 'test'
      };
      const properties = palantirConnector.getActiveProperties(undefined, data);
      expect(properties).to.eql(data);
    });

    it('should filter out ignored fields and get active properties for valid data', () => {
      const data = {
        id: 'test',
        title: 'test',
        objectTypeId: 'test',
        team: 'test',
        projectId: 0,
        testProp: 'test'
      };
      const properties = palantirConnector.getActiveProperties(settings.objectType, data);
      expect(properties).not.to.be.empty;
      expect(properties).not.to.have.property('testProp');
    });
  });
});
