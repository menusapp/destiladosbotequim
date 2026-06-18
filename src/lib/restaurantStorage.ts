/**
 * Cliente leve para a edge function `restaurant-storage-ops`.
 *
 * Substitui chamadas diretas `supabase.storage.from('backups' | 'fiscal-certificates')`
 * que antes operavam como `anon` em buckets abertos. Agora todo acesso passa pela
 * edge function, que valida o `staff_id` contra o `restaurant_id` antes de operar
 * com `service_role`.
 *
 * O `restaurant_id` e o `staff_id` são lidos automaticamente do localStorage
 * (mesmo padrão usado em todo o painel admin).
 */
import { supabase } from "@/integrations/supabase/client";

type Bucket = "backups" | "fiscal-certificates";

function getSession(): { restaurant_id: string; staff_id: string } {
  const restaurant_id = localStorage.getItem("restaurant_id") || "";
  const staff_id = localStorage.getItem("staff_id") || "";
  if (!restaurant_id || !staff_id) {
    throw new Error("Sessão inválida — faça login novamente.");
  }
  return { restaurant_id, staff_id };
}

async function call<T>(op: string, bucket: Bucket, extra: Record<string, unknown>): Promise<T> {
  const session = getSession();
  const { data, error } = await supabase.functions.invoke("restaurant-storage-ops", {
    body: { op, bucket, ...session, ...extra },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const dataUrl = r.result as string;
      resolve(dataUrl.split(",")[1] || "");
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, type?: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], type ? { type } : undefined);
}

export async function listObjects(
  bucket: Bucket,
  prefix?: string,
  limit = 100,
): Promise<{ name: string; created_at?: string }[]> {
  const res = await call<{ items: { name: string; created_at?: string }[] }>("list", bucket, {
    prefix,
    limit,
  });
  return res.items || [];
}

export async function uploadObject(
  bucket: Bucket,
  path: string,
  data: Blob | File,
  contentType?: string,
): Promise<void> {
  const content_base64 = await blobToBase64(data);
  await call("upload", bucket, {
    path,
    content_base64,
    content_type: contentType ?? (data as Blob).type,
  });
}

export async function downloadObject(bucket: Bucket, path: string): Promise<Blob> {
  const res = await call<{ content_base64: string; content_type?: string }>(
    "download",
    bucket,
    { path },
  );
  return base64ToBlob(res.content_base64, res.content_type);
}

export async function deleteObjects(bucket: Bucket, paths: string[]): Promise<void> {
  await call("delete", bucket, { paths });
}
