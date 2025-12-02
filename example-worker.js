/**
 * Example Cloudflare Edge Worker for receiving screenshot uploads
 *
 * Deploy this to Cloudflare Workers and update your uploadUrl
 *
 * Example: https://your-worker.workers.dev/screenshot
 */

export default {
  async fetch(request, env) {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Parse FormData
      const formData = await request.formData();

      // Get screenshot file
      const screenshot = formData.get('screenshot');
      if (!screenshot || !(screenshot instanceof File)) {
        return new Response('No screenshot provided', { status: 400 });
      }

      // Get metadata
      const filename = formData.get('filename');
      const timestamp = formData.get('timestamp');
      const url = formData.get('url');
      const userAgent = formData.get('userAgent');
      const viewport = JSON.parse(formData.get('viewport') || '{}');

      console.log('Screenshot received:', {
        filename,
        size: screenshot.size,
        type: screenshot.type,
        timestamp,
        url,
        viewport,
      });

      // Option 1: Upload to Cloudflare R2 (recommended for large files)
      if (env.SCREENSHOT_BUCKET) {
        const key = `screenshots/${timestamp}-${filename}`;
        await env.SCREENSHOT_BUCKET.put(key, screenshot, {
          httpMetadata: {
            contentType: screenshot.type,
          },
          customMetadata: {
            url: url,
            timestamp: timestamp,
            viewport: JSON.stringify(viewport),
          },
        });

        console.log('Uploaded to R2:', key);

        return new Response(
          JSON.stringify({
            success: true,
            key,
            message: 'Screenshot uploaded to R2',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Option 2: Store in Cloudflare KV (for smaller files < 25MB)
      if (env.SCREENSHOT_KV) {
        const arrayBuffer = await screenshot.arrayBuffer();
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(arrayBuffer))
        );

        await env.SCREENSHOT_KV.put(`screenshot:${timestamp}`, base64, {
          metadata: {
            filename,
            url,
            timestamp,
            viewport: JSON.stringify(viewport),
            size: screenshot.size,
          },
        });

        console.log('Stored in KV:', `screenshot:${timestamp}`);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Screenshot stored in KV',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Option 3: Forward to another service (e.g., S3, custom backend)
      // const uploadResponse = await fetch('https://your-backend.com/upload', {
      //   method: 'POST',
      //   body: formData,
      // });
      // return uploadResponse;

      // No storage configured
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Screenshot received (no storage configured)',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error processing screenshot:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
