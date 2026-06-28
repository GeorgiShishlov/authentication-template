// backend/src/config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Auth API',
      version: '1.0.0',
      description: 'JWT-аутентификация с подтверждением email и refresh токенами',
    },
    servers: [{ url: 'http://localhost:3001' }],
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            username:   { type: 'string' },
            email:      { type: 'string', format: 'email' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
