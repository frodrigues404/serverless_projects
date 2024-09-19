import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.TABLE_NAME;

export const handler = async (event) => {
  const { id } = event.pathParameters;

  console.log(event.pathParameters);
  console.log(event);

  const command = new GetCommand({
    TableName: tableName,
    Key: {
      ID: id,
    },
  });

  try {
    const response = await docClient.send(command);
    if (response.Item) {
      console.log(`${response.Item.ID} - (${response.Item.CUSTOMER_NAME})`);
      return {
        statusCode: 200,
        body: JSON.stringify(response.Item),
      }
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify(response.Item),
      };
    }
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};
