# website-hook-sdk

A lightweight JavaScript/TypeScript SDK for capturing user interactions on web pages and sending them into the Crow-B3 analytics/data pipeline.

## Features

- 📸 **Screenshot Capture**: High-quality web page screenshots using html2canvas-pro
- 🎯 **Auto-Capture**: Automatic screenshot capture on page load
- 🔒 **CORS Support**: Handle external images with proper CORS configuration
- ☁️ **Edge Worker Upload**: Upload screenshots to Cloudflare Workers
- 🎨 **Modern CSS Support**: Handles oklch, oklab, and other modern color functions
- 📱 **Viewport Capture**: Capture only visible area at current scroll position
- 🤖 **Auto-Configuration**: Automatically detects site info and metadata
- 💾 **Local Storage**: Automatic download and save to local file system
- ⚡ **Performance Optimized**: Industry-standard best practices
- 🛡️ **Type Safe**: Full TypeScript support with comprehensive type definitions
- 🔧 **Configurable**: Flexible configuration options for quality, format, and behavior

## Installation

```bash
pnpm install @b3-crow/website-hook-sdk
```

## Quick Start

### Auto-Capture (Recommended)

Automatically capture screenshots immediately when called:

```typescript
import { initAutoCapture } from '@b3-crow/website-hook-sdk';

// Minimal setup - SDK auto-configures everything and captures immediately
initAutoCapture({
  logging: true, // Optional: enable logging
});

// Optional: Continuous capture every 5 seconds
initAutoCapture({
  interval: 5000, // Capture every 5 seconds
  logging: true,
});
```

The SDK automatically:

- ✅ Detects site name from URL
- ✅ Captures viewport at user's scroll position
- ✅ Generates metadata (site, hostname, environment, userAgent)
- ✅ Uploads to Cloudflare Worker (if configured)
- ✅ Falls back to local download if upload fails

### Manual Capture

For more control:

```typescript
import { ScreenshotCapture } from '@b3-crow/website-hook-sdk';

const capturer = new ScreenshotCapture({
  useCORS: true,
  quality: 0.92,
});

await capturer.captureAndSave();
```

## Configuration

### Environment Variables

Configure the upload URL using environment variables:

```bash
# .env.local
NEXT_PUBLIC_SCREENSHOT_UPLOAD_URL=https://your-worker.workers.dev/screenshot
```

### React Integration

```tsx
'use client';

import { useEffect } from 'react';
import { initAutoCapture } from '@b3-crow/website-hook-sdk';

export function AutoScreenshotCapture() {
  useEffect(() => {
    initAutoCapture({ logging: true });
  }, []);

  return null;
}
```

Add to your layout:

```tsx
import { AutoScreenshotCapture } from '@/components/screenshot-auto-capture';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <AutoScreenshotCapture />
      </body>
    </html>
  );
}
```

## Documentation

For comprehensive documentation on screenshot capture functionality, see [SCREENSHOT_GUIDE.md](./SCREENSHOT_GUIDE.md).

For Cloudflare Worker setup, see [example-worker.js](./example-worker.js).

## Live Demo

Open `example.html` in your browser to see the SDK in action:

```bash
# Using Python
python3 -m http.server 8000

# Or using npx
npx serve .

# Then open: http://localhost:8000/example.html
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Lint
pnpm lint

# Format code
pnpm format
```

## Local Development

```
"@b3-crow/website-hook-sdk": "file:../website-hook-sdk"
```

## License

MIT
