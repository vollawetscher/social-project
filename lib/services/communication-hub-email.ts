export interface CreatorLeadEmailParams {
  creatorEmail: string
  userEmail: string
  templateName: string
  installedAt: string
}

export async function sendCreatorLeadEmail(params: CreatorLeadEmailParams): Promise<SendEmailResponse> {
  const { creatorEmail, userEmail, templateName, installedAt } = params
  const subject = `Neuer Nutzer für dein Template "${templateName}"`
  const body = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">Neuer Lead über Notissima</h2>
      <p style="color: #475569; line-height: 1.6;">
        Ein Nutzer hat dein Template <strong>"${templateName}"</strong> installiert und dabei seine Kontaktdaten freigegeben.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">Email des Nutzers</p>
        <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 600;">
          <a href="mailto:${userEmail}" style="color: #0d9488; text-decoration: none;">${userEmail}</a>
        </p>
        <p style="margin: 12px 0 0 0; color: #64748b; font-size: 13px;">Installiert am: ${installedAt}</p>
      </div>
      <p style="color: #475569; line-height: 1.6; font-size: 14px;">
        Du bist gemäß DSGVO für den Umgang mit dieser Email-Adresse verantwortlich.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">
        Diese Email wurde automatisch von Notissima gesendet.
      </p>
    </div>
  `.trim()
  const textBody = [
    `Neuer Lead über Notissima`,
    ``,
    `Ein Nutzer hat dein Template "${templateName}" installiert und dabei seine Kontaktdaten freigegeben.`,
    ``,
    `Email des Nutzers: ${userEmail}`,
    `Installiert am: ${installedAt}`,
    ``,
    `Du bist gemäß DSGVO für den Umgang mit dieser Email-Adresse verantwortlich.`,
  ].join('\n')

  return sendCommunicationHubEmail({
    to: creatorEmail,
    subject,
    body,
    textBody,
    fromName: 'Notissima Marketplace',
  })
}

interface SendEmailParams {
  to: string
  subject: string
  body: string
  fromName?: string
  replyTo?: string
  textBody?: string
  attachments?: Array<{
    filename: string
    contentType: string
    contentBase64?: string
    content?: string
    contentEncoding?: 'base64' | 'utf-8'
  }>
}

interface SendEmailResponse {
  success: boolean
  error?: string
  providerMessageId?: string | null
  sentWithoutAttachments?: boolean
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
  const buildPayload = (includeAttachments: boolean, attachmentStyle: 'camel' | 'snake' = 'camel') => ({
    to: params.to,
    subject: params.subject,
    body: params.body,
    ...(params.fromName && { from_name: params.fromName }),
    ...(params.replyTo && { reply_to: params.replyTo }),
    ...(params.textBody && { text_body: params.textBody }),
    ...(includeAttachments && params.attachments?.length
      ? {
          attachments: params.attachments.map((a) => ({
            filename: a.filename,
            ...(attachmentStyle === 'camel'
              ? {
                  contentType: a.contentType,
                  content: a.content || a.contentBase64 || '',
                  contentEncoding: a.contentEncoding || 'base64',
                }
              : {
                  content_type: a.contentType,
                  content_base64: a.contentBase64 || a.content || '',
                }),
          })),
        }
      : {}),
  })
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(buildPayload(true, 'camel')),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      // Retry attachment payload in legacy snake_case for backward compatibility.
      if (params.attachments?.length) {
        const legacyResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(buildPayload(true, 'snake')),
        })
        if (legacyResponse.ok) {
          const legacyData = await legacyResponse.json().catch(() => ({}))
          return {
            success: true,
            providerMessageId: legacyData?.id || legacyData?.messageId || null,
          }
        }

        // Final fallback: retry without attachments so invite delivery still succeeds.
        const noAttachmentResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(buildPayload(false)),
        })
        if (noAttachmentResponse.ok) {
          const fallbackData = await noAttachmentResponse.json().catch(() => ({}))
          return {
            success: true,
            providerMessageId: fallbackData?.id || fallbackData?.messageId || null,
            sentWithoutAttachments: true,
          }
        }
      }
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

