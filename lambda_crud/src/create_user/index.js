import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.TABLE_NAME;

export const handler = async (event) => {
  const { username, firstName, lastName, age } = JSON.parse(event.body);

  const command = new PutCommand({
    TableName: tableName,
    Item: {
      USERNAME: username ,
      CUSTOMER_FIRST_NAME: firstName ,
      CUSTOMER_LAST_NAME: lastName,
      CUSTOMER_AGE: age,
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
};
