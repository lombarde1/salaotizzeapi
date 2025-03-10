# Documentação da API de Notificações

## Índice
1. [Listar Notificações](#listar-notificações)
2. [Marcar Notificação como Lida](#marcar-notificação-como-lida)
3. [Marcar Todas as Notificações como Lidas](#marcar-todas-as-notificações-como-lidas)
4. [Obter Contagem de Notificações não Lidas](#obter-contagem-de-notificações-não-lidas)

## Endpoints

### Listar Notificações

```https
GET /api/notifications
```

#### Parâmetros de Query
| Parâmetro | Tipo    | Descrição |
|-----------|---------|------------|
| page      | number  | Número da página (padrão: 1) |
| limit     | number  | Quantidade de itens por página (padrão: 10) |
| read      | boolean | Filtrar por status de leitura (opcional) |

#### Resposta de Sucesso
```json
{
    "status": "success",
    "data": {
        "notifications": [
            {
                "_id": "notificationId",
                "userId": "userId",
                "title": "Nova Mensagem",
                "message": "Você tem um novo agendamento",
                "type": "appointment",
                "read": false,
                "createdAt": "2024-01-20T10:00:00.000Z"
            }
        ],
        "pagination": {
            "total": 50,
            "page": 1,
            "pages": 5
        }
    }
}
```

### Marcar Notificação como Lida

```https
PUT /api/notifications/:id/read
```

#### Parâmetros de URL
| Parâmetro | Tipo   | Descrição |
|-----------|--------|------------|
| id        | string | ID da notificação |

#### Resposta de Sucesso
```json
{
    "status": "success",
    "message": "Notificação marcada como lida"
}
```

### Marcar Todas as Notificações como Lidas

```https
PUT /api/notifications/read-all
```

#### Resposta de Sucesso
```json
{
    "status": "success",
    "message": "Todas as notificações foram marcadas como lidas"
}
```

### Obter Contagem de Notificações não Lidas

```https
GET /api/notifications/unread-count
```

#### Resposta de Sucesso
```json
{
    "status": "success",
    "data": {
        "count": 5
    }
}
```

## Códigos de Erro

| Código | Descrição |
|--------|------------|
| 400    | Requisição inválida |
| 401    | Não autorizado |
| 404    | Notificação não encontrada |
| 500    | Erro interno do servidor |

## Modelo de Notificação

| Campo     | Tipo    | Descrição |
|-----------|---------|------------|
| _id       | string  | ID único da notificação |
| userId    | string  | ID do usuário destinatário |
| title     | string  | Título da notificação |
| message   | string  | Conteúdo da notificação |
| type      | string  | Tipo da notificação (appointment, system, etc) |
| read      | boolean | Status de leitura |
| createdAt | date    | Data de criação |

## Observações

- Todas as requisições requerem autenticação via token JWT no header Authorization
- O token deve ser enviado no formato: `Bearer <token>`
- As datas são retornadas no formato ISO 8601
- A paginação é baseada em 1 (primeira página = 1)