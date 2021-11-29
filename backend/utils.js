const ExcelJS = require('exceljs');

const readTables = () =>
  `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG='Moocho' ORDER by TABLE_NAME ASC;`;

const detailsTable = (p) =>
  `select COLUMN_NAME, DATA_TYPE from information_schema.columns where table_name = '${p.name}';`;

const serializeDataToS3 = (data) => {
  let params = { queries: data };
  return params;
};

const saveToS3 = async (dataToS3, S3) => {
  const paramsToS3 = {
    Body: JSON.stringify(dataToS3),
    Bucket: process.env.BUCKET,
    Key: `store.json`,
    Tagging: new Date().toISOString(),
  };

  const P = await new Promise((resolve, reject) => {
    S3.putObject(paramsToS3, function (err, data) {
      if (err) {
        console.log(err);
        reject(err); // an error occurred
      } else {
        console.log(data);
        resolve(data);
      }
    });
  });

  return P;
};

const getDataFromS3 = async (S3) => {
  const params = {
    Bucket: process.env.BUCKET,
    Key: 'store.json',
  };

  let p = await new Promise((resolve, reject) => {
    S3.getObject(params, function (err, data) {
      if (err) {
        console.log(err);
        reject(err); // an error occurred
      } else {
        resolve(data.Body.toString());
      }
    });
  });

  return JSON.parse(p);
};

const response = (status, body, connection) => {
  if (connection) connection.close();
  return new Promise((resolve) => {
    resolve({
      statusCode: status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(body),
    });
  });
};

const verifyGroup = async (event) => {
  let group = '';

  if (event && event.requestContext && event.requestContext.authorizer)
    group = event.requestContext.authorizer.claims['cognito:groups'];

  if (typeof group === 'object') group = group[0];

  return group;
};

const verifyGroupByJWT = async (token, JWT) => {
  const output = JWT(token);

  console.log(output['cognito:groups'][0], 'output');
  return output['cognito:groups'][0];
};

const saveExcelToS3 = async (stream, key, S3) => {
  const paramsToS3 = {
    Body: stream,
    Bucket: process.env.BUCKET,
    Key: key,
    Tagging: new Date().toISOString(),
    ContentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const P = await new Promise((resolve, reject) => {
    S3.upload(paramsToS3, function (err, data) {
      if (err) {
        console.log(err);
        reject(err); // an error occurred
      } else {
        resolve(data);
      }
    });
  });

  return P;
};

const detailFile = async (recordsSet) => {
  let workbook = new ExcelJS.Workbook();
  let creation_date = new Date();
  workbook.creator = 'Moocho';
  workbook.modified = creation_date;
  workbook.lastPrinted = creation_date;

  let sheet = workbook.addWorksheet('My Sheet');
  recordsSet.map((recordSet) => {
    sheet.addRow(Object.keys(recordSet[0]));
    recordSet.forEach((element) => {
      sheet.addRow(Object.values(element));
    });
  });
  return workbook;
};

const wakeUpLambda = (event) => {
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUP - Lambda is warm!');
    return true;
  }
  return false;
};

module.exports = {
  response,
  readTables,
  detailsTable,
  serializeDataToS3,
  saveToS3,
  getDataFromS3,
  verifyGroup,
  saveExcelToS3,
  detailFile,
  wakeUpLambda,
  verifyGroupByJWT,
};
