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

