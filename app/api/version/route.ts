import { NextResponse } from 'next/server'

/**
 * GET /api/version
 *
 * Returns the current deployment identifier so open browser tabs can detect
 * when a newer version has been deployed (they captured an earlier value on
 * load). The git commit SHA changes on every deploy — unlike the human-facing
 * changelog version, which we only bump for user-visible changes — so it is the
 * right signal for "the client bundle you are running is stale".
 *
 * Never cached: each poll must reflect the version currently being served.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const version =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    'dev'

  return NextResponse.json(
    { version },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
