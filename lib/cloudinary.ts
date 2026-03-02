import crypto from 'crypto';

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function buildSignature(params: Record<string, string>, apiSecret: string) {
  const pairs = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(pairs + apiSecret).digest('hex');
}

type UploadRawPayload = {
  bytes: Uint8Array;
  fileName: string;
  folder: string;
  publicId: string;
  contentType?: string;
};

type UploadRawResult = {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format?: string;
};

export async function uploadRawToCloudinary(payload: UploadRawPayload): Promise<UploadRawResult> {
  const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = getEnv('CLOUDINARY_API_KEY');
  const apiSecret = getEnv('CLOUDINARY_API_SECRET');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = buildSignature(
    {
      folder: payload.folder,
      public_id: payload.publicId,
      timestamp,
    },
    apiSecret
  );

  const form = new FormData();
  const blob = new Blob([payload.bytes], { type: payload.contentType || 'application/octet-stream' });

  form.append('file', blob, payload.fileName);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('folder', payload.folder);
  form.append('public_id', payload.publicId);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary raw upload failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    resource_type?: string;
    format?: string;
  };

  if (!data.secure_url || !data.public_id || !data.resource_type) {
    throw new Error('Cloudinary raw upload returned incomplete response');
  }

  return {
    secureUrl: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type,
    format: data.format,
  };
}
