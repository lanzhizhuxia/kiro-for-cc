# Sensitive Files Test Fixtures

This directory contains example sensitive files used for testing the SecurityGuard sanitization functionality.

## Files

- **.env.example** - Example environment variables file with various sensitive keys
- **credentials.json** - JSON configuration file with database passwords, API keys, etc.
- **private-key.pem** - Example RSA private key

## Important Notes

1. **These are NOT real credentials** - All keys, passwords, and secrets in these files are fictional and used only for testing purposes.

2. **Purpose** - These files are used to test:
   - Sensitive file pattern detection
   - Content-based sensitive data detection
   - Sanitization/redaction of various secret types
   - Verification of sanitization effectiveness

3. **Security** - Even though these are test files, they should:
   - Never be committed with real credentials
   - Serve as examples of what NOT to store in version control
   - Demonstrate proper sanitization techniques

## Tested Patterns

The files contain examples of:

- Database connection strings (MongoDB, PostgreSQL, Redis)
- AWS access keys and secret keys
- API keys (OpenAI, Stripe, GitHub, Slack)
- JWT tokens
- Passwords and secrets
- Private keys (RSA, EC, OpenSSH)
- Environment variables
- JSON configuration with nested sensitive fields

## Usage in Tests

See `src/test/unit/securityGuard.sanitization.test.ts` for how these files are used in unit tests.
