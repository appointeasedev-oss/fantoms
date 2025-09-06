import { decrypt } from '@/lib/encryption'

export async function POST(req: Request) {
  try {
    const { pantryId, bucket } = (await req.json()) as { pantryId: string; bucket: string }

    if (!pantryId || !bucket) {
      return Response.json({ ok: false, error: "Missing pantryId or bucket" }, { status: 400 })
    }

    const url = `https://getpantry.cloud/apiv1/pantry/${encodeURIComponent(pantryId)}/basket/${encodeURIComponent(bucket)}`
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    if (!res.ok) {
      return Response.json({ ok: false, status: res.status, error: res.statusText }, { status: res.status })
    }

    const data = await res.json();

    // Decrypt sensitive data after fetching
    const decryptedData: { [key: string]: any } = { ...data };
    if (decryptedData.supabaseUrl) {
      decryptedData.supabaseUrl = await decrypt(decryptedData.supabaseUrl);
    }
    if (decryptedData.supabaseAnonKey) {
      decryptedData.supabaseAnonKey = await decrypt(decryptedData.supabaseAnonKey);
    }
    if (decryptedData.openrouterKey) {
      decryptedData.openrouterKey = await decrypt(decryptedData.openrouterKey);
    }

    return Response.json({ ok: true, data: decryptedData })
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 })
  }
}