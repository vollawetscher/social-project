'use client'

import { GespraechsberichtJSON, GenericReportJSON } from '@/lib/types/database'
// @ts-expect-error - GenericReportViewer has module resolution issues
import { GenericReportViewer } from './GenericReportViewer'
import { LegacyReportViewer } from './LegacyReportViewer'

interface GespraechsberichtViewerProps {
  gespraechsbericht: GespraechsberichtJSON | GenericReportJSON
}

// Type guard to check if report is GenericReportJSON
function isGenericReport(report: any): report is GenericReportJSON {
  return 'detected_domain' in report && 'report' in report
}

/**
 * Main viewer component that determines which viewer to use
 * Routes to either Generic or Legacy report viewer based on report format
 */
export function GespraechsberichtViewer({ gespraechsbericht }: GespraechsberichtViewerProps) {
  if (isGenericReport(gespraechsbericht)) {
    return <GenericReportViewer report={gespraechsbericht} />
  }
  
  return <LegacyReportViewer gespraechsbericht={gespraechsbericht} />
}
