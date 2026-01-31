/**
 * Privacy Notice for Speech Recognition
 * Informs users about GDPR-compliant voice processing
 */

import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function SpeechPrivacyNotice() {
  return (
    <Alert className="bg-green-50 border-green-200 mb-4">
      <Info className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-sm text-green-800 ml-2">
        <strong>DSGVO-konforme Spracherkennung:</strong> Ihre Sprachdaten werden ausschließlich 
        über unsere EU-Server (Speechmatics) verarbeitet. Keine Daten werden an Apple oder andere 
        Drittanbieter gesendet. EU AI Act konform.
      </AlertDescription>
    </Alert>
  )
}
