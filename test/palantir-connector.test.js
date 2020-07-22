'use strict';
const {expect} = require('chai');
describe('Palantir connector tests', () => {
  let Project;
  let projectId;

  const testProjects = [{
    title: 'Test-Project-10',
    team: 'Connector Test Team',
    projectId: 1234
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
    expect(result).to.eql({count: 1});
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

  it('should delete object', async () => {
    await Project.deleteById(projectId);
    const findObjectResult = await Project.findById(projectId);
    expect(findObjectResult.__data).to.be.empty;
  });

  it('should get objects by simple 1 column where criteria', async () => {
    const findObjectResult = await Project.find({where: {team: 'Bioprinting'}});
    expect(findObjectResult).not.to.be.empty;
  });
});

async function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
