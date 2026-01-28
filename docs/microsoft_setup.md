# Guía de Configuración de Integración Microsoft

Para habilitar la integración con Microsoft, necesitas registrar una aplicación en el Portal de Azure. Esto te proporcionará el `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, y te permitirá configurar el `MS_REDIRECT_URI`.

## 1. Registrar una Aplicación
1. Ve al [Portal de Azure](https://portal.azure.com/).
2. Busca **"Registros de aplicaciones"** (App registrations) y selecciónalo.
3. Haz clic en **"+ Nuevo registro"**.
4. **Nombre**: Ingresa un nombre (ej. "Minerva Integration").
5. **Tipos de cuenta compatibles**: Selecciona **"Cuentas en cualquier directorio organizativo (Cualquier directorio de Microsoft Entra ID: multiinquilino) y cuentas personales de Microsoft (como Skype, Xbox)"**.
   - *Este paso es crucial para permitir tanto cuentas personales (OneDrive Personal) como empresariales (OneDrive for Business).*
6. **URI de redirección**:
   - Selecciona **Web**.
   - Ingresa tu URL de callback. Para desarrollo local con Supabase Edge Functions, esto típicamente es:
     `https://<project-ref>.supabase.co/functions/v1/microsoft-auth/callback`
     *(Reemplaza `<project-ref>` con tu referencia real de proyecto Supabase)*
7. Haz clic en **Registrar**.

## 2. Obtener Credenciales
### Client ID (ID de Cliente)
- En la página de **Información general** (Overview) de tu nueva app, copia el **"Identificador de aplicación (cliente)"**.
- Este será tu `MS_CLIENT_ID`.

### Client Secret (Secreto de Cliente)
1. En el menú de la izquierda, haz clic en **Certificados y secretos**.
2. Ve a la pestaña **Secretos de cliente**.
3. Haz clic en **"+ Nuevo secreto de cliente"**.
4. Añade una descripción (ej. "Supabase Edge Function") y establece una fecha de expiración.
5. Haz clic en **Agregar**.
6. **IMPORTANTE**: Copia el **Valor** inmediatamente. No podrás verlo de nuevo una vez salgas de la página.
- Este será tu `MS_CLIENT_SECRET`.

## 3. Configurar Permisos
1. En el menú de la izquierda, haz clic en **Permisos de API**.
2. Haz clic en **"+ Agregar un permiso"**.
3. Selecciona **Microsoft Graph**.
4. Selecciona **Permisos delegados**.
5. Busca y marca los siguientes permisos:
   - `User.Read` (Iniciar sesión y leer perfil de usuario)
   - `Files.Read.All` (Leer archivos en todas las colecciones de sitios)
   - `offline_access` (Mantener acceso a datos vía Refresh Tokens)
6. Haz clic en **Agregar permisos**.

## 4. Configurar Variables de Entorno
Añade estos secretos a tu Supabase Edge Function:

```bash
supabase secrets set MS_CLIENT_ID="tu-client-id"
supabase secrets set MS_CLIENT_SECRET="tu-client-secret"
supabase secrets set MS_REDIRECT_URI="https://<project-ref>.supabase.co/functions/v1/microsoft-auth/callback"
```

---

### ¿Por qué este enfoque?
Esta integración utiliza el flujo **OAuth 2.0 Authorization Code** con un componente del lado del servidor (Supabase Edge Functions).
- **Seguridad**: Tu `MS_CLIENT_SECRET` nunca se expone al frontend ni al navegador.
- **Confiabilidad**: Almacenamos responsablemente el `Refresh Token` en una Bóveda (Vault) encriptada, permitiendo que la app mantenga al usuario conectado sin pedirle login a cada rato.
- **Control**: Todo el tráfico hacia Microsoft Graph es procesado por el servidor, permitiendo auditar accesos y manejar errores centralizadamente.
