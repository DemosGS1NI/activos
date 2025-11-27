import { success } from '../../lib/response.js';

export async function GET() {
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Internal API', version: '0.0.1' },
    paths: {
      // Route: POST /auth/register
      // Purpose: Create a new user. Returns 201 with user info and access/refresh tokens on success.
      '/auth/register': {
        post: {
          summary: 'Register new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'User created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              email: { type: 'string' },
                              name: { type: 'string', nullable: true },
                              status: { type: 'string' },
                              role_id: { type: 'string', nullable: true },
                              created_at: { type: 'string', format: 'date-time' }
                            }
                          },
                          tokens: {
                            type: 'object',
                            properties: {
                              access: { type: 'string' },
                              refresh: { type: 'string' }
                            }
                          }
                        }
                      },
                      meta: { type: 'object' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Invalid input' },
            '409': { description: 'Email already registered' }
          }
        }
      }
      // Route: POST /auth/login
      // Purpose: Authenticate existing user. Returns tokens and user flags on success.
      ,'/auth/login': {
        post: {
          summary: 'Login user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Authenticated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          user: { type: 'object' },
                          tokens: { type: 'object' },
                          flags: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': { description: 'Invalid input' },
            '401': { description: 'Invalid credentials' },
            '403': { description: 'User inactive' },
            '423': { description: 'Account locked' }
          }
        }
      }
      // Route: POST /auth/refresh
      // Purpose: Exchange a valid refresh token for a rotated refresh + new access token.
      // Note: This endpoint enforces refresh token revocation checks.
      ,'/auth/refresh': {
        post: {
          summary: 'Refresh tokens',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refresh'],
                  properties: { refresh: { type: 'string' } }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'New tokens issued',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          tokens: {
                            type: 'object',
                            properties: {
                              access: { type: 'string' },
                              refresh: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': { description: 'Missing/invalid body' },
            '401': { description: 'Invalid refresh token or user inactive' }
          }
        }
      }
    },
    components: { schemas: {} }
  };
  return success(spec);
}
