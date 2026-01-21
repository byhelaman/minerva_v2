# Security Documentation

## Overview

This document outlines the security measures implemented in Minerva v2 and important security considerations for deployment.

## Security Features

### ✅ Implemented Security Measures

1. **Database Security**
   - Row Level Security (RLS) enabled on all tables
   - JWT Custom Claims for efficient authorization
   - Privilege escalation prevention triggers
   - SECURITY DEFINER functions with secure search_path
   - Policies using `auth.jwt()` for optimal performance

2. **Authentication & Authorization**
   - Role-based access control (RBAC) with hierarchy levels
   - Password minimum length enforcement (8 characters)
   - PKCE flow for OAuth
   - Automatic token refresh management
   - Progressive rate limiting for login attempts (client-side)
   - Email enumeration protection in password reset flow

3. **API Security**
   - Webhook signature verification using HMAC-SHA256
   - Timestamp validation to prevent replay attacks
   - Constant-time comparison for API key verification
   - CORS restrictions for Edge Functions
   - User role verification for privileged operations

4. **File System Security**
   - Sandboxed file operations via Tauri capabilities
   - Native file dialogs for user-initiated file access
   - Principle of least privilege for file operations
   - No path traversal vulnerabilities

5. **Input Validation**
   - Zod schema validation on all forms
   - Parameterized Supabase queries (no SQL injection)
   - No use of dangerous functions (eval, innerHTML)
   - Proper password field handling

## Security Considerations for Production

### ⚠️ Critical Configuration Required

1. **CORS Configuration**
   
   **Files to Update:**
   - `supabase/functions/zoom-auth/index.ts` (lines 16-20)
   - `supabase/functions/zoom-webhook/index.ts` (lines 17-21)
   
   **Current Configuration (Development only):**
   ```typescript
   const ALLOWED_ORIGINS = [
       'http://localhost:1420',
       'tauri://localhost',
       'http://tauri.localhost',
   ]
   ```
   
   **Action Required:**
   Add your production domain(s) before deploying to production. For Tauri desktop apps, you may need to include platform-specific origins.

2. **Rate Limiting**
   
   **Current State:** Client-side rate limiting only (can be bypassed)
   
   **Recommendation for Production:**
   - Implement server-side rate limiting on Supabase Edge Functions
   - Consider using Supabase's built-in rate limiting or a reverse proxy
   - Monitor failed login attempts server-side
   
   **Why:** Client-side rate limiting in `src/lib/rate-limiter.ts` is stored in localStorage and can be cleared by attackers.

3. **Content Security Policy (CSP)**
   
   **Current State:** No CSP headers configured
   
   **Recommendation:**
   Configure CSP headers in Tauri's configuration to prevent XSS attacks:
   ```json
   {
     "tauri": {
       "security": {
         "csp": "default-src 'self'; connect-src 'self' https://*.supabase.co;"
       }
     }
   }
   ```

4. **Environment Variables**
   
   **Critical:**
   - Never commit `.env` file to version control
   - Rotate secrets regularly
   - Use different credentials for development and production
   - Configure Edge Function secrets in Supabase Dashboard:
     - Settings → Edge Functions → Secrets
   
   **Required Secrets:**
   - `ZOOM_CLIENT_ID`
   - `ZOOM_CLIENT_SECRET`
   - `ZOOM_WEBHOOK_SECRET`
   - `INTERNAL_API_KEY`
   - `SECRET_API_KEY`

## Token Storage

### JWT in localStorage

**Current Implementation:**
- Access tokens and refresh tokens stored in localStorage
- Storage key: `minerva-auth-token`

**Security Implications:**
- ✅ Standard practice for desktop applications (Tauri)
- ⚠️ Vulnerable to XSS attacks if application has XSS vulnerabilities
- ✅ Mitigated by React's automatic escaping and input validation

**Recommendations:**
1. Keep all dependencies updated (especially React, Tauri, and UI libraries)
2. Never use `dangerouslySetInnerHTML` or similar unsafe APIs
3. Validate all user input with Zod schemas
4. Implement CSP headers as described above

## Audit & Compliance

### Regular Security Tasks

1. **Dependency Audits**
   ```bash
   npm audit
   npm audit fix
   ```

2. **CodeQL Scanning**
   Run CodeQL security scanning before each release

3. **Manual Code Reviews**
   Focus on:
   - New authentication/authorization code
   - Database query modifications
   - File system operations
   - External API integrations

4. **Penetration Testing**
   Consider periodic penetration testing for:
   - Authentication bypass attempts
   - SQL injection vectors
   - XSS vulnerabilities
   - CSRF attacks
   - Authorization bypass

## Incident Response

### If a Security Issue is Discovered

1. **Immediate Actions:**
   - Assess the severity and scope
   - If credentials are compromised, rotate them immediately
   - Check logs for unauthorized access
   - Apply fix and deploy as soon as possible

2. **Communication:**
   - Notify affected users if data was exposed
   - Document the incident and resolution

3. **Prevention:**
   - Update this security documentation
   - Add tests to prevent regression
   - Review similar code for the same vulnerability

## Security Contact

For security issues, please report to the repository maintainers via:
- GitHub Security Advisories (preferred)
- Private email to repository owner

**Do not disclose security issues publicly until they are resolved.**

## Compliance Notes

### Data Protection

- User passwords are never stored in plaintext (handled by Supabase Auth)
- Sensitive operations require password re-verification
- Rate limiting prevents brute force attacks
- Audit logs available via Supabase Dashboard

### Best Practices Followed

- ✅ Principle of Least Privilege
- ✅ Defense in Depth
- ✅ Secure by Default
- ✅ Fail Securely
- ✅ Input Validation
- ✅ Output Encoding
- ✅ Cryptographic Protection (HMAC, PKCE)

## Version History

- 2026-01-21: Initial security documentation created
- Comprehensive security audit completed
- Password validation strengthened (8 char minimum)
- Email enumeration protection added
- Constant-time API key comparison implemented
