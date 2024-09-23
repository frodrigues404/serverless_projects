import boto3
import urllib.request
import os
import json
from urllib.parse import urlparse
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

patch_all()

bucket_name = os.environ['BUCKET_NAME']

def lambda_handler(event, context):
    try:
        with xray_recorder.in_segment('Processamento do evento SQS') as segment:
            print("Event: ", event)
            
            record = event['Records'][0]
            message_body = json.loads(record['body'])
            
            image_url = message_body['picture']
            print("Image URL: ", image_url)
        
        with xray_recorder.in_segment('Download da imagem') as segment:
            response = urllib.request.urlopen(image_url)
            image_data = response.read()

        parsed_url = urlparse(image_url)
        file_name = parsed_url.path.split('/')[-1]

        with xray_recorder.in_segment('Upload para S3') as segment:
            s3 = boto3.client('s3')
            s3.put_object(Bucket=bucket_name, Key=file_name, Body=image_data)

        return {
            'statusCode': 200,
            'body': f'Imagem {file_name} enviada com sucesso para o bucket {bucket_name}.'
        }

    except Exception as e:
        xray_recorder.current_subsegment().add_exception(e)
        return {
            'statusCode': 500,
            'body': f'Erro ao processar a imagem: {str(e)}'
        }
