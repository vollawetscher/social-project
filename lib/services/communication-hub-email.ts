interface SendEmailParams {
  to: string
  subject: string
  body: string
  fromName?: string
  replyTo?: string
  textBody?: string
}

interface SendEmailResponse {
  success: boolean
  error?: string
  providerMessageId?: string | null
}

function resolveCommunicationHubBaseUrl(): string {
  return (process.env.COM_HUB_BASE_URL || 'https://com-hub.services.netlantic.de').replace(/\/+$/, '')
}

export async function sendCommunicationHubEmail(params: SendEmailParams): Promise<SendEmailResponse> {
  const apiKey = process.env.COM_HUB_API_KEY
  if (!apiKey) {
    return {
      success: false,
      error: 'COM_HUB_API_KEY is not configured',
    }
  }

  const endpoint = `${resolveCommunicationHubBaseUrl()}/api/email/send`
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        body: params.body,
        ...(params.fromName && { from_name: params.fromName }),
        ...(params.replyTo && { reply_to: params.replyTo }),
        ...(params.textBody && { text_body: params.textBody }),
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return {
        success: false,
        error: errText || `HTTP ${response.status}`,
      }
    }

    const data = await response.json().catch(() => ({}))
    return {
      success: true,
      providerMessageId: data?.id || data?.messageId || null,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error sending email',
    }
  }
}

