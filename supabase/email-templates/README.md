# Plantillas de email de autenticación — Knowbi

Plantillas HTML para los correos transaccionales de Supabase Auth, con el sistema de
diseño de la app (colores y fuentes de la landing). La mascota se sirve desde
`https://knowbiapp.space/assets/mascot-head.png` (los clientes de correo exigen
imágenes alojadas públicamente).

## Cómo aplicarlas

Supabase Studio → **Authentication → Emails → Templates** → abre cada plantilla,
pega el **asunto** en su campo y el **HTML completo** del archivo en el cuerpo.

| Archivo | Plantilla de Supabase | Asunto | Variables |
|---------|----------------------|--------|-----------|
| `confirm-signup.html` | Confirm sign up | `Confirma tu cuenta de Knowbi` | `{{ .ConfirmationURL }}` |
| `reset-password.html` | Reset password | `Recupera tu acceso a Knowbi` | `{{ .ConfirmationURL }}` |
| `magic-link.html` | Magic link or OTP | `Tu código de acceso a Knowbi` | `{{ .Token }}` |

## Notas

- **Fuentes:** Apple Mail / iOS cargan Nunito + DM Sans vía `@import`. Gmail y Outlook
  ignoran el `<style>` y caen a un fallback de sistema (Trebuchet MS / Segoe UI). El
  diseño aguanta bien en ambos casos.
- **`magic-link.html`** muestra **solo el código** (`{{ .Token }}`). La app no usa login
  por enlace mágico: la recuperación de contraseña (`recover.tsx` → `signInWithOtp`) envía
  un código de 6 dígitos que se teclea en la app, así que el botón de enlace se quitó a
  propósito (abría el navegador, no la app).
- **Amber (#EF9F27):** deliberadamente ausente — por regla de marca es exclusivo de la
  racha, no se usa en estos correos.
- Tras pegar cada plantilla, usa **Send test email** en Supabase para verla en tu
  bandeja real antes de dar la fase por cerrada.
