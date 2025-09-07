import { decryptWithPassword } from '@/lib/encryption'

export async function POST(req: Request) {
  try {
    const { pantryId, bucket, password } = (await req.json()) as { 
      pantryId: string; 
      bucket: string; 
      password: string;
    }

    if (!pantryId || !bucket || !password) {
      return Response.json({ ok: false, error: "Missing pantryId, bucket, or password" }, { status: 400 })
    }

    const url = `https://getpantry.cloud/apiv1/pantry/${encodeURIComponent(pantryId)}/basket/${encodeURIComponent(bucket)}`
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    if (!res.ok) {
      return Response.json({ ok: false, status: res.status, error: res.statusText }, { status: res.status })
    }

    const encryptedData = await res.json();

    // Decrypt ALL data fields using user password
    const decryptedData: { [key: string]: any } = {};
    
    for (const [key, value] of Object.entries(encryptedData)) {
      if (typeof value === 'string' && value) {
        try {
          decryptedData[key] = await decryptWithPassword(value, password, pantryId, bucket);
        } catch (decryptError) {
          // If decryption fails, it might be due to wrong password
          return Response.json({ 
            ok: false, 
            error: "Failed to decrypt data. Please check your password." 
          }, { status: 401 })
        }
      } else {
        decryptedData[key] = value; // Keep non-string values as-is
      }
    }

    return Response.json({ ok: true, data: decryptedData })
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 })
  }
}