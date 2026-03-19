const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://funilperseguicao.com"

interface SenhaRedefinidaParams {
  nome: string
}

export function senhaRedefinidaTemplate({ nome }: SenhaRedefinidaParams): {
  subject: string
  html: string
  text: string
} {
  const subject = "Senha redefinida com sucesso — Funil Perseguição"
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
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <div style="display:inline-block;background:#0D0D12;border:1px solid #1E1E2A;border-radius:12px;padding:16px 32px;">
                <span style="color:#25D366;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Funil Perseguição</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#16161E;border:1px solid #1E1E2A;border-radius:16px;padding:40px;">
              <div style="text-align:center;margin:0 0 24px 0;">
                <div style="display:inline-block;background:rgba(37,211,102,0.15);border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;font-size:28px;">✅</div>
              </div>
              <h1 style="margin:0 0 8px 0;color:#F1F1F3;font-size:24px;font-weight:700;text-align:center;">Senha redefinida!</h1>
              <p style="margin:0 0 24px 0;color:#8B8B9E;font-size:15px;line-height:1.6;text-align:center;">
                Olá, ${primeiroNome}! Sua senha foi alterada com sucesso.
              </p>

              <a href="${appUrl}/login" style="display:block;text-align:center;background:#25D366;color:#000000;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;margin:0 0 24px 0;">
                Fazer Login →
              </a>

              <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:16px;">
                <p style="margin:0;color:#F87171;font-size:13px;line-height:1.5;">
                  ⚠️ <strong>Não foi você?</strong> Entre em contato com o administrador imediatamente em <a href="mailto:${process.env.EMAIL_FROM || "sistema@funilperseguicao.com"}" style="color:#F87171;">${process.env.EMAIL_FROM || "sistema@funilperseguicao.com"}</a>
                </p>
              </div>
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

  const text = `Olá, ${primeiroNome}!\n\nSua senha foi redefinida com sucesso.\n\nAcesse: ${appUrl}/login\n\nSe não foi você, entre em contato com o administrador imediatamente.\n\nFunil Perseguição`

  return { subject, html, text }
}
