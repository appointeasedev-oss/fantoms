import postgres from "postgres"

export async function POST(req: Request) {
  try {
    const { dbUrl } = (await req.json()) as { dbUrl?: string | null }
    if (!dbUrl) {
      return Response.json({ ok: false, skipped: true })
    }

    // Ensure SSL for Supabase Postgres
    const sql = postgres(dbUrl, { ssl: "require" as any })

    try {
      await sql`create table if not exists fantoms_probe(id serial primary key);`
      await sql`drop table if exists fantoms_probe;`
      await sql.end()
      return Response.json({ ok: true, skipped: false })
    } catch (inner: any) {
      try {
        await sql.end()
      } catch {}
      return Response.json(
        { ok: false, skipped: false, error: inner?.message || "SQL execution failed" },
        { status: 500 },
      )
    }
  } catch (err: any) {
    return Response.json({ ok: false, skipped: false, error: err?.message || "Unknown error" }, { status: 500 })
  }
}
