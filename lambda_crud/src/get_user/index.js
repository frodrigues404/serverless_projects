import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async () => {
  const secret = await get_secret();

  const command = new ScanCommand({
    ProjectionExpression: "ID, CUSTOMER_NAME",
    TableName: secret.TABLE_NAME,
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
