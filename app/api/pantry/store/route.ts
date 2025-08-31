export async function POST(req: Request) {
  try {
    const { pantryId, bucket, data } = (await req.json()) as {
      pantryId: string
      bucket: string
      data: unknown
    }

    if (!pantryId || !bucket) {
      return Response.json({ ok: false, error: "Missing pantryId or bucket" }, { status: 400 })
    }

    const url = `https://getpantry.cloud/apiv1/pantry/${encodeURIComponent(pantryId)}/basket/${encodeURIComponent(bucket)}`
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data ?? {}),
    })

    return Response.json({ ok: res.ok, status: res.status, statusText: res.statusText })
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 })
  }
}
