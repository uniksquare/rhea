import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const docClient = DynamoDBDocumentClient.from(client);

export async function putItem(tableName: string, item: Record<string, any>) {
  try {
    const result = await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );
    return result;
  } catch (err) {
    console.error(`Error putting item into ${tableName}:`, err);
    throw err;
  }
}

export async function getItem(tableName: string, key: Record<string, any>) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
      })
    );
    return result.Item;
  } catch (err) {
    console.error(`Error getting item from ${tableName}:`, err);
    throw err;
  }
}

export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>
) {
  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes;
  } catch (err) {
    console.error(`Error updating item in ${tableName}:`, err);
    throw err;
  }
}
