## loopback-connector-palantir [![Build Status](https://travis-ci.com/LabShare/loopback-connector-palantir.svg)](https://travis-ci.com/LabShare/loopback-connector-palantir)
[**LoopBack**](http://loopback.io/) is a highly-extensible, open-source Node.js framework that enables you to create dynamic end-to-end REST APIs with little or no coding. It also enables you to access data from major relational databases, MongoDB, SOAP and REST APIs.


**loopback-connector-palantir** is the Palantir Phonograph2 connector module for [loopback-datasource-juggler](https://github.com/strongloop/loopback-datasource-juggler).

**Palantir Phonograph2** provides a table-based API to read and write [Foundry](https://www.palantir.com/palantir-foundry/) rows. It also is the store for all data in the Ontology

## Basic usage

#### Installation
Install the module using the command below in your projects root directory:
```sh
npm i loopback-connector-palantir
```

#### Configuration

* `serviceUrl` (env: `PALANTIR_SERVICE_URL` ): Palantir API URL root.
* `apiToken`(env: `PALANTIR_API_TOKEN`): JWT token to access Palantir API
* `objectType`(env: `PALANTIR_OBJECT_TYPE`): Palantir object type to use with the connector. In Palantir object type identifies a data set. 
* `policy`(env: `PALANTIR_POLICY`): A value for `policy` property to be use when adding new objects. 
* `debug`: when true, prints debugging information to console. 

Below is the sample datasource configuration file:

```json
{
  "name": "sample-datasource",
  "connector": "palantir",
  "serviceUrl": "https://nidap.nih.gov/phonograph2/api",
  "apiToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  "objectType": "hts-projects-test",
  "policy": "NCATS"  
}
```

#### NOTE: Defining Models
Palantir LB connector provides options for mapping between Palantir data setsand Loopback models and their properties.
These options are set in the LB4 decorators inside `palantir` element. 

`propertyName` - Name of property withing Palantir object to map to the LM model. If not specified then model class name is used. 
`unique` - A boolean flag indicating whether the property uniquely identifies objects in Palantir data set.

Example: project.model.ts
```typescript
import {Entity, property, model} from '@loopback/repository';

@model()
export class Project extends Entity {
  @property({
    type: 'number',
    id: true,
    palantir: {
      propertyName: 'project_uid',
      unique: true  
    },
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
    palantir: {
      propertyName: 'project',
    },
  })
  title: string;

  @property({
    type: 'string',
    palantir: {
      propertyName: 'team',
    },
  })
  team: string;
}
```


Palantir Phonograph2 REST API documentation:
https://gypsum.palantircloud.com/workspace/documentation/developer/api/phonograph2/services/ObjectStorageService
https://gypsum.palantircloud.com/workspace/documentation/developer/api/phonograph2/services/ObjectSearchService
