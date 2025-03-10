# API de Serviços

## Endpoints

### Criar Novo Serviço
- **URL**: `/services`
- **Método**: POST
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Corpo da Requisição**:
```json
{
    "name": "Corte de Cabelo",
    "description": "Corte masculino ou feminino",
    "price": 50.00,
    "duration": 30,
    "category": "Cabelo",
    "commissionType": "percentage",
    "commissionValue": 30
}
```
- **Campos**:
  - `name` (string, obrigatório): Nome do serviço
  - `description` (string): Descrição do serviço
  - `price` (number, obrigatório): Preço do serviço
  - `duration` (number, obrigatório): Duração em minutos
  - `category` (string): Categoria do serviço
  - `commissionType` (string): Tipo de comissão ('fixed' ou 'percentage')
  - `commissionValue` (number): Valor da comissão

- **Resposta de Sucesso**:
  - **Código**: 201
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "service": {
            "_id": "service_id",
            "name": "Corte de Cabelo",
            "description": "Corte masculino ou feminino",
            "price": 50.00,
            "duration": 30,
            "category": "Cabelo",
            "commissionType": "percentage",
            "commissionValue": 30,
            "status": "active",
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        }
    }
}
```

### Listar Serviços
- **URL**: `/services`
- **Método**: GET
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Parâmetros de Query**:
  - `category` (string, opcional): Filtrar por categoria
  - `status` (string, opcional): Filtrar por status ('active' ou 'inactive')
  - `sortBy` (string, opcional): Campo para ordenação
  - `order` (string, opcional): Direção da ordenação ('asc' ou 'desc')
  - `page` (number, opcional): Número da página
  - `limit` (number, opcional): Itens por página

- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "services": [
            {
                "_id": "service_id",
                "name": "Corte de Cabelo",
                "description": "Corte masculino ou feminino",
                "price": 50.00,
                "duration": 30,
                "category": "Cabelo",
                "status": "active"
            }
        ],
        "total": 1,
        "pages": 1,
        "currentPage": 1
    }
}
```

### Obter Serviço por ID
- **URL**: `/services/:id`
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
        "service": {
            "_id": "service_id",
            "name": "Corte de Cabelo",
            "description": "Corte masculino ou feminino",
            "price": 50.00,
            "duration": 30,
            "category": "Cabelo",
            "commissionType": "percentage",
            "commissionValue": 30,
            "status": "active"
        }
    }
}
```

### Atualizar Serviço
- **URL**: `/services/:id`
- **Método**: PUT
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Corpo da Requisição**:
```json
{
    "price": 60.00,
    "duration": 45,
    "commissionValue": 35
}
```

- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "service": {
            "_id": "service_id",
            "name": "Corte de Cabelo",
            "price": 60.00,
            "duration": 45,
            "commissionValue": 35
        }
    }
}
```

### Desativar Serviço
- **URL**: `/services/:id`
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
    "message": "Serviço desativado com sucesso"
}
```

## Códigos de Erro

- **400 Bad Request**
  - Dados inválidos no corpo da requisição
  - Campos obrigatórios ausentes
  - Valores inválidos

- **401 Unauthorized**
  - Token de autenticação ausente ou inválido

- **403 Forbidden**
  - Usuário não tem permissão para acessar o recurso

- **404 Not Found**
  - Serviço não encontrado

- **500 Internal Server Error**
  - Erro interno do servidor

## Observações

1. Todos os endpoints requerem autenticação via JWT token
2. O campo `status` pode ser 'active' ou 'inactive'
3. O campo `commissionType` pode ser 'fixed' (valor fixo) ou 'percentage' (porcentagem)
4. A duração do serviço é sempre em minutos
5. Preços devem ser enviados com até 2 casas decimais
6. A paginação é baseada em 1 (primeira página é 1, não 0)
7. Por padrão, a listagem retorna 10 itens por página