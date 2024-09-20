import axios from "axios";
import AWSXRay from "aws-xray-sdk-core";
import AWS from "aws-sdk";
import http from "http";
import https from "https";

const sqs = AWSXRay.captureAWSClient(new AWS.SQS({ apiVersion: "2012-11-05" }));
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

AWSXRay.captureHTTPsGlobal(http);
AWSXRay.captureHTTPsGlobal(https);
AWSXRay.capturePromise();

const instance = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

export const handler = async () => {
  const apiUrl = "https://randomuser.me/api/";

  try {
    const segment = AWSXRay.getSegment();
    const subsegment = segment.addNewSubsegment("External API: randomuser.me");
    const response = await instance.get(apiUrl);
    const randomUser = response.data.results[0];
    subsegment.addAnnotation("HTTP Status", response.status);
    subsegment.close();

    const result = {
      username: randomUser.login.username,
      name: randomUser.name.first,
      email: randomUser.email,
      phone: randomUser.phone,
      age: randomUser.dob.age,
      picture: randomUser.picture.large,
    };

    var params = {
      DelaySeconds: 10,
      MessageAttributes: {
        Title: {
          DataType: "String",
          StringValue: "Random User",
        },
        TraceId: {
          DataType: "String",
          StringValue: AWSXRay.getSegment().trace_id,
        },
      },
      MessageBody: JSON.stringify(result),
      QueueUrl: SQS_QUEUE_URL,
    };

    const subsegmentSQS = segment.addNewSubsegment("SQS SendMessage");

    try {
      await sqs.sendMessage(params).promise();
      subsegmentSQS.close();
    } catch (error) {
      subsegmentSQS.addError(error);
      subsegmentSQS.close();
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro ao buscar usuário aleatório",
        error: error.message,
      }),
    };
  }
};
