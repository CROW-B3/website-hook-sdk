# website-hook-sdk

A lightweight JavaScript/TypeScript SDK for capturing user interactions on web pages and sending them into the Crow-B3 analytics/data pipeline.

## Features

- 📸 **Screenshot Capture**: High-quality web page screenshots using html2canvas
- 🔒 **CORS Support**: Handle external images with proper CORS configuration
- 💾 **Local Storage**: Automatic download and save to local file system
- ⚡ **Performance Optimized**: Industry-standard best practices
- 🛡️ **Type Safe**: Full TypeScript support with comprehensive type definitions
- 🔧 **Configurable**: Flexible configuration options for quality, format, and behavior

## Installation

```bash
bun install @b3-crow/website-hook-sdk
```

## Quick Start

```typescript
import { ScreenshotCapture } from '@b3-crow/website-hook-sdk';

// Initialize the SDK
const capturer = new ScreenshotCapture({
  useCORS: true,
  quality: 0.92,
});

// Capture and save screenshot
await capturer.captureAndSave();
```

## Documentation

For comprehensive documentation on screenshot capture functionality, see [SCREENSHOT_GUIDE.md](./SCREENSHOT_GUIDE.md).

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
bun install

# Build
bun run build

# Lint
bun run lint

# Format code
bun run format
```

## Local Development

```
"@b3-crow/website-hook-sdk": "file:../website-hook-sdk"
```

## License

MIT
