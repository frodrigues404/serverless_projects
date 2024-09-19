import axios from 'axios';
import AWSXRay from 'aws-xray-sdk-core';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import http from 'http';
import https from 'https';

AWSXRay.captureHTTPsGlobal(http);
AWSXRay.captureHTTPsGlobal(https);
AWSXRay.capturePromise();

const AWS_REGION = process.env.REGION;
const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = AWSXRay.captureAWSv3Client(client);
const docClient = DynamoDBDocumentClient.from(ddb);
const TABLE_NAME = process.env.TABLE_NAME;

const instance = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
});

export const handler = async () => {
  const apiUrl = 'https://randomuser.me/api/';
  const segment = AWSXRay.getSegment();
  const subsegment = segment.addNewSubsegment('External API: randomuser.me');

  try {
    const response = await instance.get(apiUrl);
    const randomUser = response.data.results[0];
    subsegment.addAnnotation('HTTP Status', response.status);
    subsegment.close();

    const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
        USERNAME: randomUser.login.username,
        CUSTOMER_FIRST_NAME: randomUser.name.first ,
        CUSTOMER_LAST_NAME: randomUser.name.last,
        CUSTOMER_AGE: randomUser.dob.age,
    },
    ConditionExpression: "attribute_not_exists(USERNAME)",
    });

    try {
    const response = await docClient.send(command);
    return {
        statusCode: 200,
        body: JSON.stringify(response),
    };
    } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
        return {
        statusCode: 400,
        body: JSON.stringify({ message: "Username já está em uso" }),
        };
    }
    return {
        statusCode: 500,
        body: JSON.stringify(err),
    };
    }

  } catch (error) {
    subsegment.addError(error);
    subsegment.close();

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Erro ao buscar usuário aleatório',
        error: error.message,
      }),
    };
  }

};
