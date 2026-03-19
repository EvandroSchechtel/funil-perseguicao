import { Resend } from "resend"

let resend: Resend | null = null

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.EMAIL_API_KEY
    if (!apiKey || apiKey === "re_placeholder") {
      console.warn("[Email] EMAIL_API_KEY not configured — emails will be logged only")
    }
    resend = new Resend(apiKey || "re_placeholder")
  }
  return resend
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const from = `${process.env.EMAIL_FROM_NAME || "Funil Perseguição"} <${process.env.EMAIL_FROM || "sistema@funilperseguicao.com"}>`

  if (process.env.NODE_ENV === "development" && (!process.env.EMAIL_API_KEY || process.env.EMAIL_API_KEY === "re_placeholder")) {
    console.log(`\n[Email DEV] To: ${to}`)
    console.log(`[Email DEV] Subject: ${subject}`)
    console.log(`[Email DEV] Body: ${text || "(HTML only)"}`)
    console.log("[Email DEV] HTML:", html.substring(0, 200), "...\n")
    return
  }

  try {
    const client = getResend()
    const result = await client.emails.send({
      from,
      to,
      subject,
      html,
      text: text || "",
    })

    if (result.error) {
      console.error("[Email] Send error:", result.error)
    } else {
      console.log(`[Email] Sent to ${to} — id: ${result.data?.id}`)
    }
  } catch (error) {
    console.error("[Email] Unexpected error:", error)
    // Don't throw — email failure shouldn't break the main flow
  }
}
