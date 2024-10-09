import axios from "axios";
import AWSXRay from "aws-xray-sdk-core";
import AWS from "aws-sdk";
import http from "http";
import https from "https";

const axiosInstance = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

const { SQS_QUEUE_URL, SQS_QUEUE_URL_IMAGE } = process.env;

const sqs = AWSXRay.captureAWSClient(new AWS.SQS({ apiVersion: "2012-11-05" }));

export const handler = async () => {
  const apiUrl = "https://randomuser.me/api/";
  const segment = AWSXRay.getSegment();

  if (!segment) {
    console.error("X-Ray segment not found.");
    return { statusCode: 500, body: "Internal server error" };
  }

  const traceId = segment.trace_id;

  const fetchRandomUser = async () => {
    const apiSubsegment = segment.addNewSubsegment("External API: randomuser.me");
    try {
      const response = await axiosInstance.get(apiUrl);
      apiSubsegment.addAnnotation("HTTP Status", response.status);
      return response.data.results[0];
    } catch (error) {
      apiSubsegment.addError(error);
      console.error("Error fetching random user:", error);
      throw new Error("Failed to fetch random user");
    } finally {
      apiSubsegment.close();
    }
  };

  const createSqsMessageParams = (queueUrl, title, messageBody, traceId) => ({
    DelaySeconds: 10,
    MessageAttributes: {
      TraceId: { DataType: "String", StringValue: traceId },
      Title: { DataType: "String", StringValue: title },
    },
    MessageBody: JSON.stringify(messageBody),
    QueueUrl: queueUrl,
  });

  const sendSQSMessage = async (params, subsegmentName) => {
    const sqsSubsegment = segment.addNewSubsegment(subsegmentName);
    try {
      await sqs.sendMessage(params).promise();
    } catch (error) {
      sqsSubsegment.addError(error);
      console.error(`Error sending SQS message to ${params.QueueUrl}:`, error);
      throw new Error("Failed to send SQS message");
    } finally {
      sqsSubsegment.close();
    }
  };

  try {
    const randomUser = await fetchRandomUser();

    const userMessage = {
      username: randomUser.login.username,
      name: randomUser.name.first,
      email: randomUser.email,
      phone: randomUser.phone,
      age: randomUser.dob.age,
      picture: randomUser.picture.large,
    };

    await Promise.all([
      sendSQSMessage(
        createSqsMessageParams(SQS_QUEUE_URL_IMAGE, "Random User Image", { username: userMessage.username, picture: userMessage.picture }, traceId),
        "SQS SendMessage Image"
      ),
      sendSQSMessage(
        createSqsMessageParams(SQS_QUEUE_URL, "Random User", userMessage, traceId),
        "SQS SendMessage User"
      ),
    ]);

    return { statusCode: 200, body: JSON.stringify({ message: "Messages sent successfully!" }) };
  } catch (error) {
    console.error("Error in handler:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to process request" }) };
  }
};
