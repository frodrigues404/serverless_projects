import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import AWSXRay from 'aws-xray-sdk'

const AWS_REGION = process.env.REGION;
const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = AWSXRay.captureAWSv3Client(client);
const docClient = DynamoDBDocumentClient.from(ddb);
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async () => {

  const command = new ScanCommand({
    ProjectionExpression: "USERNAME, CUSTOMER_FIRST_NAME, COSTUMER_LAST_NAME",
    TableName: TABLE_NAME,
  });

  try {
    const response = await docClient.send(command);
    if (response.Items.length > 0) {
      for (const Item of response.Items) {
        console.log(`${Item.ID} - (${Item.CUSTOMER_NAME})`);
      }
      return {
        statusCode: 200,
        body: JSON.stringify(response.Items),
      };
    } else {
      return {
        statusCode: 404,
        errorMessage: "No items found",
        body: JSON.stringify(response.Items),
      };
    }
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    }
  }
};
