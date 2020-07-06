'use strict';
require('dotenv').config();
const path = require('path');
const timeout = 20000;
const juggler = require('loopback-datasource-juggler');
let DataSource = juggler.DataSource;
const nock = require('nock');

const config = {
  serviceUrl: process.env.PALANTIR_SERVICE_URL,
  apiToken: process.env.PALANTIR_API_TOKEN,
  objectType: process.env.PALANTIR_OBJECT_TYPE,
  policy: process.env.PALANTIR_POLICY,
  debug: true
};

global.config = config;
let db;
let nockDone;

global.getDataSource = global.getSchema = (customConfig, customClass) => {
  const ctor = customClass || DataSource;
  db = new ctor(require('../'), customConfig || config);
  db.log = (a) => {
    console.log(a);
  };
  return db;
};

global.resetDataSourceClass = (ctor) => {
  DataSource = ctor || juggler.DataSource;
  const promise = db ? db.disconnect() : Promise.resolve();
  db = undefined;
  return promise;
};

if (!process.env.DISABLE_NOCK) {
  before(async function() {
    this.timeout(timeout);
    nock.back.fixtures = path.join(__dirname, './fixtures/nock-fixtures');
    nock.back.setMode('record');
    nock.enableNetConnect();
    // @ts-ignore
    global.nock = nock;
    nockDone = (await nock.back('palantir-connector.json', {
      before: beforeNock
    })).nockDone;
  });

  after(async function() {
    nockDone();
    this.timeout(5000);
  });
}
const beforeNock = (scope) => {
  // ignore request body when matching nock recorded fixtures
  scope.filteringRequestBody = (body, aRecordedBody) => {
    return aRecordedBody;
  };
};
