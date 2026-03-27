import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"

// PATCH /api/notifications/read  { ids: string[] }
export async function PATCH(request: Request) {
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
  if (!ids.length) return NextResponse.json({ error: "No ids provided" }, { status: 400 })

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
