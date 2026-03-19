const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://funilperseguicao.com"

interface RecuperacaoSenhaParams {
  nome: string
  token: string
}

export function recuperacaoSenhaTemplate({ nome, token }: RecuperacaoSenhaParams): {
  subject: string
  html: string
  text: string
} {
  const subject = "Redefinição de senha — Funil Perseguição"
  const primeiroNome = nome.split(" ")[0]
  const resetUrl = `${appUrl}/redefinir-senha?token=${token}`

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
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <div style="display:inline-block;background:#0D0D12;border:1px solid #1E1E2A;border-radius:12px;padding:16px 32px;">
                <span style="color:#25D366;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Funil Perseguição</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#16161E;border:1px solid #1E1E2A;border-radius:16px;padding:40px;">
              <h1 style="margin:0 0 8px 0;color:#F1F1F3;font-size:24px;font-weight:700;">Redefinir senha</h1>
              <p style="margin:0 0 24px 0;color:#8B8B9E;font-size:15px;line-height:1.6;">
                Olá, ${primeiroNome}! Recebemos uma solicitação para redefinir a senha da sua conta.
              </p>

              <a href="${resetUrl}" style="display:block;text-align:center;background:#25D366;color:#000000;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;margin:0 0 24px 0;">
                Redefinir Minha Senha →
              </a>

              <div style="background:#111118;border:1px solid #1E1E2A;border-radius:10px;padding:16px;margin:0 0 24px 0;">
                <p style="margin:0 0 4px 0;color:#8B8B9E;font-size:12px;">Ou acesse diretamente este link:</p>
                <p style="margin:0;color:#34D67A;font-size:12px;word-break:break-all;font-family:monospace;">${resetUrl}</p>
              </div>

              <div style="background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.2);border-radius:10px;padding:16px;margin:0 0 24px 0;">
                <p style="margin:0;color:#FACC15;font-size:13px;line-height:1.5;">
                  ⏱ Este link expira em <strong>1 hora</strong> e só pode ser usado uma vez.
                </p>
              </div>

              <p style="margin:0;color:#5A5A72;font-size:13px;line-height:1.5;">
                Se você não solicitou a redefinição de senha, ignore este email. Sua senha permanece a mesma.
              </p>
            </td>
          </tr>
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

  const text = `Olá, ${primeiroNome}!\n\nSolicitação de redefinição de senha recebida.\n\nClique no link abaixo para redefinir sua senha (expira em 1 hora):\n${resetUrl}\n\nSe não foi você, ignore este email.\n\nFunil Perseguição`

  return { subject, html, text }
}
