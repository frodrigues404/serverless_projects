import os
import boto3
import requests
from urllib.parse import urlparse

BUCKET_NAME = os.environ['BUCKET_NAME']

def lambda_handler(event, context):
    image_url = event.body.picture
    if not image_url:
        return {
            'statusCode': 400,
            'body': 'URL da imagem não fornecida.'
        }

    try:
        # Faz o download da imagem
        response = requests.get(image_url)
        response.raise_for_status()
        image_data = response.content

        # Extrai o nome do arquivo da URL
        parsed_url = urlparse(image_url)
        file_name = parsed_url.path.split('/')[-1]

        # Define o nome do bucket S3
        bucket_name = BUCKET_NAME

        # Faz o upload para o S3
        s3 = boto3.client('s3')
        s3.put_object(Bucket=bucket_name, Key=file_name, Body=image_data)

        return {
            'statusCode': 200,
            'body': f'Imagem {file_name} enviada com sucesso para o bucket {bucket_name}.'
        }
    except requests.exceptions.RequestException as e:
        return {
            'statusCode': 500,
            'body': f'Erro ao baixar a imagem: {str(e)}'
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': f'Erro ao enviar a imagem para o S3: {str(e)}'
        }
