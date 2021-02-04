'use strict';
const {expect} = require('chai');
describe('Palantir connector tests', () => {
  let Project;
  let projectId;

  const testProjects = [{
    title: 'Test-Project-10',
    team: 'Connector Test Team',
    projectId: 1234
  }, {
    title: 'Test-Project-11',
    team: 'Connector Test Team',
    projectId: 2345
  }, {
    title: 'Test-Project-12',
    team: 'Connector Test Team',
    projectId: 3456
  }];

  before(() => {
    const ds = global.getDataSource();
    Project = ds.define('Project', {
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
  });

  it('should create objects', async () => {
    const result = await Project.create(testProjects);
    expect(result).to.be.an('array').that.is.not.empty;
    projectId = result[0].id;
    expect(projectId).to.not.be.empty;
    await delay(2000);
  });

  it('should create objects with noPolicy option set', async () => {
    const result = await Project.create(testProjects, {noPolicy: true});
    expect(result).to.be.an('array').that.is.not.empty;
    projectId = result[0].id;
    expect(projectId).to.not.be.empty;
    await delay(2000);
  });

  it('should get object back', async () => {
    const expectedResult = Object.assign({}, testProjects[0], {
      id: projectId,
      objectTypeId: process.env.PALANTIR_OBJECT_TYPE
    });
    const result = await Project.findById(projectId);
    expect(result.__data).to.eql(expectedResult);
  });

  it('should get object count', async () => {
    const result = await Project.count({team: testProjects[0].team});
    expect(result).to.eql({count: 3});
  });

  it('should get objects by where filter', async () => {
    const result = await Project.find({where: {team: testProjects[0].team}, order: 'title'});
    expect(result[0].__data).to.include({
      title: 'Test-Project-10',
      objectTypeId: 'hts-projects-axle',
      team: 'Connector Test Team',
      projectId: 1234
    });
  });

  it('should get objects by where filter with specific properties', async () => {
    const result = await Project.find({where: {team: testProjects[0].team}, fields: {team: true}});
    expect(result[0].__data).to.eql({
      team: 'Connector Test Team'
    });
  });

  it('should use default pageSize of 10000 when not specified', async () => {
    const results = await Project.find({where: {team: testProjects[0].team}, order: 'title'});
    expect(results.length).to.eql(3);
  });

  it('should apply pageSize to limit results', async () => {
    const results = await Project.find({where: {team: testProjects[0].team}, order: 'title'}, {pageSize: 1});
    expect(results.length).to.eql(1);
  });

  it('should update object by id', async () => {
    const newProject = {
      title: 'Test-Project-10-modified',
      team: 'Connector Test Team',
      projectId: 12345678
    };
    await Project.replaceById(projectId, newProject);
    await delay(2000);
    const findObjectResult = await Project.findById(projectId);
    expect(findObjectResult.__data).to.include(newProject);
  });

  it('should update object by criteria', async () => {
    await Project.update({team: testProjects[0].team}, {team: 'Connector Test Team Modified'});
    await delay(2000);
    const findObjectResults = await Project.find({where: {team: 'Connector Test Team Modified'}});
    expect(findObjectResults.length).to.eql(3);
  });

  it('should delete object by id', async () => {
    await Project.deleteById(projectId);
    await delay(2000);
    const findObjectResult = await Project.findById(projectId);
    expect(findObjectResult.__data).to.be.empty;
  });

  it('should delete object by criteria', async () => {
    await Project.deleteAll({team: 'Connector Test Team Modified'});
    await delay(2000);
    const findObjectResult = await Project.find({where: {team: 'Connector Test Team Modified'}});
    expect(findObjectResult).to.be.empty;
  });
});

async function delay(ms) {
  if (!process.env.DISABLE_NOCK) {
    return;
  }
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
