const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://funilperseguicao.com"

interface BoasVindasParams {
  nome: string
  email: string
  senhaTemporaria?: string
}

export function boasVindasTemplate({ nome, email, senhaTemporaria }: BoasVindasParams): {
  subject: string
  html: string
  text: string
} {
  const subject = "Bem-vindo ao Funil Perseguição!"
  const primeiroNome = nome.split(" ")[0]

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0B0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0B0F;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <div style="display:inline-block;background:#0D0D12;border:1px solid #1E1E2A;border-radius:12px;padding:16px 32px;">
                <span style="color:#25D366;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Funil Perseguição</span>
              </div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#16161E;border:1px solid #1E1E2A;border-radius:16px;padding:40px;">
              <h1 style="margin:0 0 8px 0;color:#F1F1F3;font-size:24px;font-weight:700;">Olá, ${primeiroNome}! 👋</h1>
              <p style="margin:0 0 24px 0;color:#8B8B9E;font-size:15px;line-height:1.6;">
                Sua conta foi criada com sucesso. Bem-vindo ao sistema de gerenciamento de webhooks.
              </p>

              <div style="background:#111118;border:1px solid #1E1E2A;border-radius:10px;padding:20px;margin:0 0 24px 0;">
                <p style="margin:0 0 8px 0;color:#8B8B9E;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Suas credenciais</p>
                <p style="margin:0 0 4px 0;color:#F1F1F3;font-size:14px;"><strong>Email:</strong> ${email}</p>
                ${senhaTemporaria ? `<p style="margin:0;color:#F1F1F3;font-size:14px;"><strong>Senha temporária:</strong> <code style="font-family:monospace;background:#0B0B0F;padding:2px 6px;border-radius:4px;color:#34D67A;">${senhaTemporaria}</code></p>` : ""}
              </div>

              ${
                senhaTemporaria
                  ? `<div style="background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.2);border-radius:10px;padding:16px;margin:0 0 24px 0;">
                <p style="margin:0;color:#FACC15;font-size:13px;line-height:1.5;">
                  ⚠️ <strong>Importante:</strong> Você precisará criar uma nova senha no primeiro acesso.
                </p>
              </div>`
                  : ""
              }

              <a href="${appUrl}/login" style="display:block;text-align:center;background:#25D366;color:#000000;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;margin:0 0 24px 0;">
                Acessar o Sistema →
              </a>

              <p style="margin:0;color:#5A5A72;font-size:13px;line-height:1.5;">
                Se você não esperava receber este email, por favor ignore-o ou entre em contato com o administrador.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;text-align:center;">
              <p style="margin:0;color:#5A5A72;font-size:12px;">
                © ${new Date().getFullYear()} Funil Perseguição. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Olá, ${primeiroNome}!\n\nSua conta foi criada no Funil Perseguição.\n\nEmail: ${email}${senhaTemporaria ? `\nSenha temporária: ${senhaTemporaria}` : ""}\n\nAcesse: ${appUrl}/login\n\nFunil Perseguição`

  return { subject, html, text }
}
