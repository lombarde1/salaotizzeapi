# Documentação da API de Produtos

## Modelo do Produto

| Campo          | Tipo    | Descrição |
|----------------|---------|------------|
| _id            | string  | ID único do produto |
| name           | string  | Nome do produto |
| description    | string  | Descrição do produto |
| purchasePrice  | number  | Preço de compra |
| salePrice      | number  | Preço de venda |
| stock          | number  | Quantidade em estoque |
| minStock       | number  | Quantidade mínima de estoque |
| brand          | string  | Marca do produto |
| category       | string  | Categoria do produto |
| barcode        | string  | Código de barras |
| commissionType | string  | Tipo de comissão (none/percentage/fixed) |
| commissionValue| number  | Valor da comissão |
| status         | string  | Status do produto (active/inactive) |
| createdAt      | date    | Data de criação |
| updatedAt      | date    | Data da última atualização |

## Endpoints

### Criar Novo Produto
- **URL**: `/products`
- **Método**: POST
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Corpo da Requisição**:
```json
{
    "name": "Nome do Produto",
    "description": "Descrição do produto",
    "purchasePrice": 50.00,
    "salePrice": 100.00,
    "minStock": 5,
    "brand": "Marca",
    "category": "Categoria",
    "barcode": "789123456",
    "commissionType": "percentage",
    "commissionValue": 10
}
```
- **Resposta de Sucesso**:
  - **Código**: 201
- **Possíveis Erros**:
  - `Nome é obrigatório`
  - `Preço de venda deve ser um número positivo`
  - `Preço de compra deve ser um número positivo`
  - `Estoque mínimo deve ser um número positivo`
  - `Tipo de comissão inválido`
  - `Valor da comissão deve ser positivo`
  - `Já existe um produto com este nome`
  - `Preço de venda deve ser maior ou igual ao preço de compra`

### Listar Produtos
- **URL**: `/products`
- **Método**: GET
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Parâmetros de Query**:
  - `category`: Categoria do produto (opcional)
  - `brand`: Marca do produto (opcional)
  - `status`: Status do produto (opcional)
  - `sortBy`: Campo para ordenação (opcional)
  - `order`: Direção da ordenação (asc/desc) (opcional)
  - `page`: Número da página (opcional, padrão: 1)
  - `limit`: Itens por página (opcional, padrão: 10)
- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "products": [
            {
                "_id": "product_id",
                "name": "Nome do Produto",
                "description": "Descrição do produto",
                "salePrice": 100.00,
                "stock": 15,
                "status": "active"
            }
        ],
        "page": 1,
        "limit": 10,
        "total": 1
    }
}
```

### Obter Produto por ID
- **URL**: `/products/:id`
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
        "_id": "product_id",
        "name": "Nome do Produto",
        "description": "Descrição do produto",
        "purchasePrice": 50.00,
        "salePrice": 100.00,
        "stock": 15,
        "minStock": 5,
        "brand": "Marca",
        "category": "Categoria",
        "commissionType": "percentage",
        "commissionValue": 10,
        "status": "active"
    }
}
```
- **Possíveis Erros**:
  - `Produto não encontrado`

### Atualizar Produto
- **URL**: `/products/:id`
- **Método**: PUT
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Corpo da Requisição**:
```json
{
    "name": "Novo Nome do Produto",
    "description": "Nova descrição",
    "purchasePrice": 60.00,
    "salePrice": 120.00,
    "minStock": 10,
    "brand": "Nova Marca",
    "category": "Nova Categoria",
    "commissionType": "fixed",
    "commissionValue": 15
}
```
- **Resposta de Sucesso**:
  - **Código**: 200
- **Possíveis Erros**:
  - `Atualizações inválidas`
  - `Produto não encontrado`
  - `Já existe um produto com este nome`
  - `Preço de venda deve ser maior ou igual ao preço de compra`

### Atualizar Estoque
- **URL**: `/products/:id/stock`
- **Método**: PUT
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Corpo da Requisição**:
```json
{
    "quantity": 10,
    "type": "in",
    "reason": "Compra de fornecedor"
}
```
- **Resposta de Sucesso**:
  - **Código**: 200
  - **Exemplo**:
```json
{
    "status": "success",
    "data": {
        "currentStock": 25,
        "previousStock": 15
    }
}
```
- **Possíveis Erros**:
  - `Quantidade deve ser um número positivo`
  - `Tipo de operação inválido`
  - `Motivo é obrigatório`
  - `Produto não encontrado`
  - `Operação resultaria em estoque negativo`

### Desativar Produto
- **URL**: `/products/:id`
- **Método**: DELETE
- **Autenticação**: Requerida
- **Headers**:
  - `Authorization: Bearer jwt_token`
- **Resposta de Sucesso**:
  - **Código**: 200
- **Possíveis Erros**:
  - `Produto não encontrado`

### Listar Produtos com Estoque Baixo
- **URL**: `/products/low-stock`
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
        "products": [
            {
                "name": "Nome do Produto",
                "stock": 3,
                "minStock": 5,
                "status": "active"
            }
        ]
    }
}
```

### Obter Categorias
- **URL**: `/products/categories`
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
        "categories": ["Shampoo", "Condicionador", "Tintura"]
    }
}
```

### Obter Marcas
- **URL**: `/products/brands`
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
        "brands": ["L'Oréal", "Wella", "Kerastase"]
    }
}