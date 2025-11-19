/**
 * SecurityGuard - 敏感文件保护和脱敏测试
 */

import { SecurityGuard } from '../../features/codex/securityGuard';

// Mock vscode module
const mockOutputChannel = {
  appendLine: jest.fn(),
  dispose: jest.fn(),
  name: 'Test',
  append: jest.fn(),
  clear: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  replace: jest.fn()
};

jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => mockOutputChannel)
  },
  workspace: {
    workspaceFolders: []
  }
}), { virtual: true });

describe('SecurityGuard - Sanitization Tests', () => {
  let guard: SecurityGuard;

  beforeEach(() => {
    guard = new SecurityGuard(mockOutputChannel as any);
    jest.clearAllMocks();
  });

  describe('Private Keys Sanitization', () => {
    test('should sanitize RSA private keys', () => {
      const content = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdef
ghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----`;

      const sanitized = guard.sanitizeContent(content, 'pem');

      expect(sanitized.includes('***REDACTED PRIVATE KEY***')).toBe(true);
      expect(sanitized.includes('MIIEpAIBAAKCAQEA')).toBe(false);
      expect(sanitized.includes('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
      expect(sanitized.includes('-----END RSA PRIVATE KEY-----')).toBe(true);
    });

    test('should sanitize EC private keys', () => {
      const content = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIAbcdef1234567890
-----END EC PRIVATE KEY-----`;

      const sanitized = guard.sanitizeContent(content, 'pem');

      expect(sanitized.includes('***REDACTED PRIVATE KEY***')).toBe(true);
      expect(sanitized.includes('MHcCAQEEIAbcdef')).toBe(false);
    });

    test('should sanitize OpenSSH private keys', () => {
      const content = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmU
-----END OPENSSH PRIVATE KEY-----`;

      const sanitized = guard.sanitizeContent(content, 'pem');

      expect(sanitized.includes('***REDACTED PRIVATE KEY***')).toBe(true);
      expect(sanitized.includes('b3BlbnNzaC1rZXk')).toBe(false);
    });
  });

  describe('AWS Keys Sanitization', () => {
    test('should sanitize AWS access keys', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const sanitized = guard.sanitizeContent(content, 'env');

      expect(sanitized.includes('***REDACTED_AWS_KEY***')).toBe(true);
      expect(sanitized.includes('AKIAIOSFODNN7EXAMPLE')).toBe(false);
    });

    test('should sanitize AWS secret keys', () => {
      const content = 'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      const sanitized = guard.sanitizeContent(content, 'env');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('wJalrXUtnFEMI')).toBe(false);
    });

    test('should sanitize AWS keys in JSON format', () => {
      const content = JSON.stringify({
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG'
      });

      const sanitized = guard.sanitizeContent(content, 'json');

      expect(sanitized.includes('***REDACTED_AWS_KEY***')).toBe(true);
      expect(sanitized.includes('AKIAIOSFODNN7EXAMPLE')).toBe(false);
    });
  });

  describe('Database Connection Strings Sanitization', () => {
    test('should sanitize MongoDB connection strings', () => {
      const content = 'mongodb://username:password123@localhost:27017/mydb';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('mongodb://***REDACTED***:***REDACTED***@')).toBe(true);
      expect(sanitized.includes('username:password123')).toBe(false);
      expect(sanitized.includes('localhost:27017/mydb')).toBe(true);
    });

    test('should sanitize MySQL connection strings', () => {
      const content = 'mysql://admin:secret@db.example.com:3306/production';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('mysql://***REDACTED***:***REDACTED***@')).toBe(true);
      expect(sanitized.includes('admin:secret')).toBe(false);
    });

    test('should sanitize PostgreSQL connection strings', () => {
      const content = 'postgres://user:pass@localhost:5432/database';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('postgres://***REDACTED***:***REDACTED***@')).toBe(true);
      expect(sanitized.includes('user:pass')).toBe(false);
    });

    test('should sanitize Redis connection strings', () => {
      const content = 'redis://default:mypassword@redis.example.com:6379';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('redis://***REDACTED***:***REDACTED***@')).toBe(true);
      expect(sanitized.includes('mypassword')).toBe(false);
    });
  });

  describe('API Keys Sanitization', () => {
    test('should sanitize API keys in key=value format', () => {
      const content = 'api_key=sk-1234567890abcdef';
      const sanitized = guard.sanitizeContent(content, 'env');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('sk-1234567890abcdef')).toBe(false);
    });

    test('should sanitize API keys with quotes', () => {
      const content = 'apiKey: "1234567890abcdef"';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('1234567890abcdef')).toBe(false);
    });

    test('should sanitize X-API-Key headers', () => {
      const content = 'x-api-key: Bearer abc123def456';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('abc123def456')).toBe(false);
    });

    test('should sanitize Authorization headers', () => {
      const content = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(false);
    });
  });

  describe('Passwords Sanitization', () => {
    test('should sanitize password in key=value format', () => {
      const content = 'password=mysecretpassword';
      const sanitized = guard.sanitizeContent(content, 'env');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('mysecretpassword')).toBe(false);
    });

    test('should sanitize passwd field', () => {
      const content = 'passwd: "P@ssw0rd123"';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('P@ssw0rd123')).toBe(false);
    });

    test('should sanitize pwd field', () => {
      const content = 'pwd = secret123';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('secret123')).toBe(false);
    });
  });

  describe('Tokens Sanitization', () => {
    test('should sanitize token in key=value format', () => {
      const content = 'token=ghp_1234567890abcdefghijklmnop';
      const sanitized = guard.sanitizeContent(content, 'env');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('ghp_1234567890abcdefghijklmnop')).toBe(false);
    });

    test('should sanitize auth_token field', () => {
      const content = 'auth_token: "xoxb-1234567890-abcdefghijk"';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('xoxb-1234567890-abcdefghijk')).toBe(false);
    });

    test('should sanitize bearer tokens', () => {
      const content = 'bearer: token123456';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('token123456')).toBe(false);
    });
  });

  describe('JWT Token Sanitization', () => {
    test('should sanitize JWT tokens', () => {
      const content = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('eyJ***REDACTED_JWT_TOKEN***')).toBe(true);
      expect(sanitized.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ')).toBe(false);
    });
  });

  describe('Generic Secret Sanitization', () => {
    test('should sanitize secret_key fields', () => {
      const content = 'secret_key: "my-super-secret-key-12345"';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('my-super-secret-key-12345')).toBe(false);
    });

    test('should sanitize private_data fields', () => {
      const content = 'private_data = "confidential-information"';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('confidential-information')).toBe(false);
    });
  });

  describe('.env File Sanitization', () => {
    test('should sanitize .env file while preserving structure', () => {
      const content = `NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://user:pass@localhost/db
API_KEY=sk-1234567890
DEBUG=true`;

      const sanitized = guard.sanitizeContent(content, 'env');

      // 非敏感值应保留
      expect(sanitized.includes('NODE_ENV=production')).toBe(true);
      expect(sanitized.includes('PORT=3000')).toBe(true);
      expect(sanitized.includes('DEBUG=true')).toBe(true);

      // 敏感值应脱敏
      expect(sanitized.includes('user:pass')).toBe(false);
      expect(sanitized.includes('sk-1234567890')).toBe(false);
    });

    test('should preserve non-sensitive environment variables', () => {
      const content = `LOG_LEVEL=info
HOST=localhost
NODE_ENV=development`;

      const sanitized = guard.sanitizeContent(content, 'env');

      expect(sanitized.includes('LOG_LEVEL=info')).toBe(true);
      expect(sanitized.includes('HOST=localhost')).toBe(true);
      expect(sanitized.includes('NODE_ENV=development')).toBe(true);
    });
  });

  describe('JSON Object Sanitization', () => {
    test('should sanitize JSON with sensitive fields', () => {
      const content = JSON.stringify({
        username: 'john',
        password: 'secret123',
        apiKey: 'sk-1234567890',
        email: 'john@example.com'
      }, null, 2);

      const sanitized = guard.sanitizeContent(content, 'json');
      const parsed = JSON.parse(sanitized);

      expect(parsed.username).toBe( 'john');
      expect(parsed.password).toBe( '***REDACTED***');
      expect(parsed.apiKey).toBe( '***REDACTED***');
      expect(parsed.email).toBe( 'john@example.com');
    });

    test('should recursively sanitize nested JSON objects', () => {
      const content = JSON.stringify({
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            token: 'abc123'
          }
        },
        config: {
          apiKey: 'key123'
        }
      }, null, 2);

      const sanitized = guard.sanitizeContent(content, 'json');
      const parsed = JSON.parse(sanitized);

      expect(parsed.user.name).toBe( 'John');
      expect(parsed.user.credentials.password).toBe( '***REDACTED***');
      expect(parsed.user.credentials.token).toBe( '***REDACTED***');
      expect(parsed.config.apiKey).toBe( '***REDACTED***');
    });

    test('should sanitize JSON arrays with sensitive objects', () => {
      const content = JSON.stringify({
        users: [
          { name: 'user1', password: 'pass1' },
          { name: 'user2', password: 'pass2' }
        ]
      }, null, 2);

      const sanitized = guard.sanitizeContent(content, 'json');
      const parsed = JSON.parse(sanitized);

      expect(parsed.users[0].name).toBe( 'user1');
      expect(parsed.users[0].password).toBe( '***REDACTED***');
      expect(parsed.users[1].name).toBe( 'user2');
      expect(parsed.users[1].password).toBe( '***REDACTED***');
    });
  });

  describe('Sanitization Verification', () => {
    test('should verify successful sanitization', () => {
      const original = 'password=secret123\napi_key=sk-1234567890';
      const sanitized = guard.sanitizeContent(original, 'env');

      const verification = guard.verifySanitization(original, sanitized);

      expect(verification.passed).toBe(true);
      expect(verification.leakedPatterns.length).toBe( 0);
      expect(verification.redactionCount > 0).toBe(true);
    });

    test('should detect leaked patterns', () => {
      const original = 'password=secret123';
      const poorlySanitized = 'password=secret123'; // Not sanitized

      const verification = guard.verifySanitization(original, poorlySanitized);

      expect(verification.passed).toBeFalsy();
      expect(verification.leakedPatterns.length > 0).toBe(true);
    });

    test('should count redactions', () => {
      const original = `password=secret123
api_key=sk-1234567890
token=ghp-abcdef`;

      const sanitized = guard.sanitizeContent(original, 'env');
      const verification = guard.verifySanitization(original, sanitized);

      expect(verification.redactionCount >= 3).toBe(true);
    });
  });

  describe('Multiple Pattern Sanitization', () => {
    test('should sanitize multiple patterns in single content', () => {
      const content = `Database: mongodb://user:pass@localhost/db
API Key: sk-1234567890abcdef
Private Key:
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890
-----END RSA PRIVATE KEY-----
JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123`;

      const sanitized = guard.sanitizeContent(content, 'txt');

      // 验证所有模式都被脱敏
      expect(sanitized.includes('user:pass')).toBe(false);
      expect(sanitized.includes('sk-1234567890abcdef')).toBe(false);
      expect(sanitized.includes('MIIEpAIBAAKCAQEA1234567890')).toBe(false);
      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('***REDACTED PRIVATE KEY***')).toBe(true);
      expect(sanitized.includes('eyJ***REDACTED_JWT_TOKEN***')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty content', () => {
      const content = '';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized).toBe( '');
    });

    test('should handle content with no sensitive data', () => {
      const content = 'This is a normal text file with no secrets.';
      const sanitized = guard.sanitizeContent(content, 'txt');

      expect(sanitized).toBe( content);
    });

    test('should handle malformed JSON gracefully', () => {
      const content = '{ "password": "secret123" invalid json }';
      const sanitized = guard.sanitizeContent(content, 'json');

      // 应该回退到正则脱敏
      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes('secret123')).toBe(false);
    });

    test('should handle very long secrets', () => {
      const longSecret = 'a'.repeat(1000);
      const content = `password=${longSecret}`;
      const sanitized = guard.sanitizeContent(content, 'env');

      expect(sanitized.includes('***REDACTED***')).toBe(true);
      expect(sanitized.includes(longSecret)).toBe(false);
    });
  });
});
