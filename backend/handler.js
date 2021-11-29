
const sql = require("mssql");
const moment = require("moment");
const { db } = require("./config/db");
const AWS = require("aws-sdk");
const Stream = require("stream");
const JWT = require('jwt-decode');
const sizeof = require('object-sizeof');
const apiGateway = new AWS.ApiGatewayManagementApi({
  endpoint: process.env['SOCKET_ENDPOINT'],
})

const {
  saveExcelToS3,
  response,
  readTables,
  detailsTable,
  serializeDataToS3,
  saveToS3,
  getDataFromS3,
  verifyGroup,
  detailFile,
  wakeUpLambda,
  verifyGroupByJWT
} = require("./utils");


module.exports.run = async event => {
  
  try {
    if (wakeUpLambda(event))
      return await response(200, { message: "just warnUp me" }, null);

    const group = await verifyGroup(event);

    if (!group) throw Error("group_not_valid.");

    if (event.body === null || event.body === undefined)
      throw Error("missing_params..");

    let body = JSON.parse(event.body);
    
    if (!body || body.query === "") throw Error("missing_body");
    
    const connection = await sql.connect(db(group));
    const db_response = await sql.query(body.query);
    
    delete db_response.recordset;

    if (db_response && db_response.recordsets[0]) {
      db_response.recordsets[0].map((x, i) => {
        Object.keys(x).map(key => {
          if (x[key] instanceof Date) {
            x[key] = moment(
              x[key]
                .toISOString()
                .replace("T", " ")
                .replace("Z", "")
            ).format("M/DD/YYYY hh:mm:ss A ");
          }
        });

        let index = Object.keys(x).findIndex(e => e === "");
        if (index >= 0) {
          x[`column${1}`] = x[""];
          delete x[""];
        }
      });
    }
    return await response(200, db_response, connection);
  } catch (e) {
    console.log(e, "<--- error");
    return await response(400, e.message, null);
  }
};

module.exports.runSocket = async event => {
  let _connection
  try {
    console.log(event,'event');

    const {
      requestContext: { connectionId, routeKey }
    } = event

    _connection = connectionId

    switch (routeKey) {
      case '$connect':
        console.log(`Connected with id ${_connection}`)
        break

      case '$disconnect':
        console.log(`Disconnected from ${_connection}`)
        break

      case 'query_raw':
        let body = JSON.parse(event.body);
        console.log(body);
        const group = await verifyGroupByJWT(body.data._x, JWT)

        if (!group) throw Error("group_not_valid.");
        console.log('connecting')

        const connection = await sql.connect(db(group));
        console.log('connected...')
        const db_response = await sql.query(body.data.query);
        console.log('getting the response')
        delete db_response.recordset;
        console.log(sizeof(db_response.recordsets[0]));


        if (db_response && db_response.recordsets[0]) {
          db_response.recordsets[0].map((x, i) => {
            Object.keys(x).map(key => {
              if (x[key] instanceof Date) {
                x[key] = moment(
                  x[key]
                    .toISOString()
                    .replace("T", " ")
                    .replace("Z", "")
                ).format("M/DD/YYYY hh:mm:ss A ");
              }
            });

            let index = Object.keys(x).findIndex(e => e === "");
            if (index >= 0) {
              x[`column${1}`] = x[""];
              delete x[""];
            }
          });
        }

        if(sizeof(db_response.recordsets[0]) > 32000){
          console.log('Data too large')

          let index = 0;
          let size = 0

          for (let i = 0; i < db_response.recordsets[0].length; i++) {
            const currentSize = sizeof(db_response.recordsets[0][i])
            if (size + currentSize < 30000)
              size += currentSize
            else {
              size = 0
              const temp = db_response.recordsets[0].slice(index, i)
              index = i
              console.log('chunk', temp)
              await apiGatewayPost(_connection, {'response': temp, 'queryToLong': true})
            }
          }
          await apiGatewayPost(_connection, {'response': 'process completed', 'queryToLong': true})
        }else {
          console.log('sending the response')
          await apiGatewayPost(_connection, {'response':db_response, 'queryToLong': false})
        }
        console.log('DONE')
        connection.close();
        break

      default:
        console.log(`Error `)
        console.error({ routeKey: 'Route not supported' })
        if (_connection) await apiGatewayPost(_connection, 'Not supported')
        break
    }

    return await response(200, {message:'socket!'}, null);
  } catch (e) {
    console.log(e, "<--- error");
    if (_connection) await apiGatewayPost(_connection, e.message )
  }
};

const apiGatewayPost = async (ConnectionId, data) =>{
  return await apiGateway
    .postToConnection({
      ConnectionId,
      Data: JSON.stringify(data),
    })
    .promise()
    .catch(e => {
      console.error({ ConnectionId: e })
      return { ConnectionId: e }
    })
}



module.exports.tables = async event => {
  try {
    if (wakeUpLambda(event))
      return await response(200, { message: "just warnUp me" }, null);
    const connection = await sql.connect(db(null));
    const db_response = await sql.query(readTables());
    const tables = db_response.recordsets[0].map(x => x.TABLE_NAME);
    return await response(200, tables, connection);
  } catch (e) {
    console.log(e, "<--- error");
    return await response(400, e.message, null);
  }
};

module.exports.details = async event => {
  try {
    if (wakeUpLambda(event))
      return await response(200, { message: "just warnUp me" }, null);
    const param = event.queryStringParameters;

    if (!param || !param.name) Error("missing_body");

    const connection = await sql.connect(db(null));
    const db_response = await sql.query(detailsTable(param));
    const columns = db_response.recordsets[0].map(
      x => `${x.COLUMN_NAME} (${x.DATA_TYPE})`
    );
    return await response(200, columns, connection);
  } catch (e) {
    console.log(e, "<--- error");
    return await response(400, e.message, null);
  }
};

module.exports.saveQuery = async event => {
  try {
    if (wakeUpLambda(event))
      return await response(200, { message: "just warnUp me" }, null);

    if (event.body === null || event.body === undefined)
      throw Error("missing_params ...");

    let body = JSON.parse(event.body);

    if (!body) throw Error("missing_body");

    const dataToS3 = serializeDataToS3(body);
    const S3 = new AWS.S3();
    await saveToS3(dataToS3, S3);

    return await response(200, dataToS3, null);
  } catch (e) {
    console.log(e, "<--- error");
    return await response(400, e.message, null);
  }
};

module.exports.getQueries = async event => {
  try {
    if (wakeUpLambda(event))
      return await response(200, { message: "just warnUp me" }, null);
    const S3 = new AWS.S3();
    const rp = await getDataFromS3(S3);
    return await response(200, rp, null);
  } catch (e) {
    console.log(e, "<--- error");
    return await response(400, e.message, null);
  }
};

module.exports.excel = async event => {
  try {
    if (wakeUpLambda(event))
      return await response(200, { message: "just warnUp me" }, null);
    if (event.body === null || event.body === undefined) {
      throw Error("missing_params");
    }
    
    let body = JSON.parse(event.body);
    
    if (!body || body.query === "") throw Error("missing_body");

    const connection = await sql.connect(db(null));
    const stream = new Stream.PassThrough();
    const db_response = await sql.query(body.query);
    const { recordsets } = db_response;
    if (!(recordsets && recordsets[0])) {
      throw Error("There is no recordset");
    }

    let workbook = await detailFile(recordsets);
    const S3 = new AWS.S3();
    const random = Math.floor(Math.random() * 100);
    const key = `recordset_${new Date().getTime()}_${random}.xlsx`;

    let download_link = "";
    await workbook.xlsx.write(stream);
    await saveExcelToS3(stream, key, S3);

    download_link = S3.getSignedUrl("getObject", {
      Key: key,
      Bucket: process.env.BUCKET
    });

    return await response(200, { link: download_link }, connection);
  } catch (e) {
    console.log(e, "<--- error");
    return await response(400, e.message, null);
  }
};
