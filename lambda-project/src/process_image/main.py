import boto3
import urllib.request
import os
import json
from urllib.parse import urlparse

bucket_name = os.environ['BUCKET_NAME']

def lambda_handler(event, context):
    try:
        # Extrai a URL da imagem do evento
        print("Event: ", event)
        
        # Acessa o primeiro registro no evento SQS
        record = event['Records'][0]
        
        # O body da mensagem SQS é uma string, então fazemos o parsing
        message_body = json.loads(record['body'])
        
        # Agora podemos acessar a URL da imagem no campo "picture"
        image_url = message_body['picture']
        print("Image URL: ", image_url)

        # Faz o download da imagem
        response = urllib.request.urlopen(image_url)
        image_data = response.read()

        # Extrai o nome do arquivo da URL
        parsed_url = urlparse(image_url)
        file_name = parsed_url.path.split('/')[-1]

        # Faz o upload para o S3
        s3 = boto3.client('s3')
        s3.put_object(Bucket=bucket_name, Key=file_name, Body=image_data)

        return {
            'statusCode': 200,
            'body': f'Imagem {file_name} enviada com sucesso para o bucket {bucket_name}.'
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': f'Erro ao processar a imagem: {str(e)}'
        }
