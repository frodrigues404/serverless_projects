import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.TABLE_NAME;

export const handler = async (event) => {
  // const id = event.pathParameters;
  console.log(event);
  console.log(event.pathParameters)
  // const command = new DeleteCommand({
  //   TableName: tableName,
  //   Key: {
  //     ID: id,
  //   },
  // });
  try {
    // const response = await docClient.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    }
  }
};
