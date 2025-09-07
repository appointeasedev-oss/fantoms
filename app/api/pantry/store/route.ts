import { encryptWithPassword } from '@/lib/encryption'

export async function POST(req: Request) {
  try {
    const { pantryId, bucket, data, password } = (await req.json()) as {
      pantryId: string
      bucket: string
      password: string
      data: {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
        openrouterKey?: string;
        passwordVerification?: string;
        [key: string]: any;
      }
    }

    if (!pantryId || !bucket || !password) {
      return Response.json({ ok: false, error: "Missing pantryId, bucket, or password" }, { status: 400 })
    }

    // Encrypt ALL data fields using user password
    const encryptedData: { [key: string]: any } = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value) {
        encryptedData[key] = await encryptWithPassword(value, password, pantryId, bucket);
      } else {
        encryptedData[key] = value; // Keep non-string values as-is
      }
    }

    const url = `https://getpantry.cloud/apiv1/pantry/${encodeURIComponent(pantryId)}/basket/${encodeURIComponent(bucket)}`
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encryptedData),
    })

    return Response.json({ ok: res.ok, status: res.status, statusText: res.statusText })
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 })
  }
}