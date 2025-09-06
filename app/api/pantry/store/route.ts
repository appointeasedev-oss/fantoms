import { encrypt } from '@/lib/encryption'

export async function POST(req: Request) {
  try {
    const { pantryId, bucket, data } = (await req.json()) as {
      pantryId: string
      bucket: string
      data: {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
        openrouterKey?: string;
        [key: string]: any; // Allow other properties
      }
    }

    if (!pantryId || !bucket) {
      return Response.json({ ok: false, error: "Missing pantryId or bucket" }, { status: 400 })
    }

    // Encrypt sensitive data before storing
    const encryptedData: { [key: string]: any } = { ...data };
    if (encryptedData.supabaseUrl) {
      encryptedData.supabaseUrl = await encrypt(encryptedData.supabaseUrl);
    }
    if (encryptedData.supabaseAnonKey) {
      encryptedData.supabaseAnonKey = await encrypt(encryptedData.supabaseAnonKey);
    }
    if (encryptedData.openrouterKey) {
      encryptedData.openrouterKey = await encrypt(encryptedData.openrouterKey);
    }

    const url = `https://getpantry.cloud/apiv1/pantry/${encodeURIComponent(pantryId)}/basket/${encodeURIComponent(bucket)}`
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encryptedData ?? {}),
    })

    return Response.json({ ok: res.ok, status: res.status, statusText: res.statusText })
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 })
  }
}