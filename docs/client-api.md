# API de Clientes

## Criar Novo Cliente
- **URL**: `/clients`
- **Método**: POST
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Corpo da Requisição**:
```json
{
    "name": "Nome do Cliente",
    "phone": "11999999999",
    "email": "cliente@exemplo.com",
    "cpf": "12345678900",
    "city": "São Paulo",
    "description": "Observações sobre o cliente"
}
```
- **Resposta de Sucesso**:
  - **Código**: 201
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "client": {
            "name": "Nome do Cliente",
            "phone": "11999999999",
            "email": "cliente@exemplo.com",
            "status": "active"
        }
    }
}
```

## Listar Clientes
- **URL**: `/clients`
- **Método**: GET
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Parâmetros de Query**:
  - `page`: Número da página (opcional, padrão: 1)
  - `limit`: Limite de itens por página (opcional, padrão: 20)
  - `search`: Termo de busca (opcional)
  - `status`: Status do cliente (opcional)
  - `sortBy`: Campo para ordenação (opcional, formato: campo:ordem)
- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "clients": [
            {
                "name": "Nome do Cliente",
                "phone": "11999999999",
                "email": "cliente@exemplo.com",
                "status": "active"
            }
        ],
        "total": 50,
        "page": 1,
        "pages": 3
    }
}
```

## Busca Rápida de Clientes
- **URL**: `/clients/search`
- **Método**: GET
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Parâmetros de Query**:
  - `q`: Termo de busca (obrigatório)
- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "clients": [
            {
                "name": "Nome do Cliente",
                "phone": "11999999999"
            }
        ]
    }
}
```

## Obter Cliente por ID
- **URL**: `/clients/:id`
- **Método**: GET
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "client": {
            "name": "Nome do Cliente",
            "phone": "11999999999",
            "email": "cliente@exemplo.com",
            "cpf": "12345678900",
            "city": "São Paulo",
            "description": "Observações sobre o cliente",
            "status": "active"
        }
    }
}
```

## Atualizar Cliente
- **URL**: `/clients/:id`
- **Método**: PATCH
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Corpo da Requisição**:
```json
{
    "name": "Novo Nome do Cliente",
    "phone": "11999999999",
    "email": "novoemail@exemplo.com"
}
```
- **Campos Atualizáveis**:
  - `name`
  - `phone`
  - `email`
  - `cpf`
  - `city`
  - `description`
  - `status`
- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "client": {
            "name": "Novo Nome do Cliente",
            "phone": "11999999999",
            "email": "novoemail@exemplo.com",
            "status": "active"
        }
    }
}
```

## Desativar Cliente
- **URL**: `/clients/:id`
- **Método**: DELETE
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "message": "Client deactivated successfully"
}
```

## Obter Histórico do Cliente
- **URL**: `/clients/:id/history`
- **Método**: GET
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "client": {
            "name": "Nome do Cliente",
            "status": "active"
        },
        "history": []
    }
}
```

## Códigos de Erro
- **400 Bad Request**:
  - Dados inválidos no corpo da requisição
  - Operações de atualização inválidas
- **401 Unauthorized**:
  - Token de autenticação ausente ou inválido
- **404 Not Found**:
  - Cliente não encontrado
- **500 Internal Server Error**:
  - Erro interno do servidor