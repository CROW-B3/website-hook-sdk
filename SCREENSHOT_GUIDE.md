# Screenshot Capture Guide

## Overview

The Website Hook SDK provides powerful screenshot capture capabilities using html2canvas. This guide covers implementation, best practices, and industry standards.

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

## Installation

```bash
pnpm add @b3-crow/website-hook-sdk
```

## Features

- ✅ High-quality screenshot capture
- ✅ Automatic local file download
- ✅ CORS support for external images
- ✅ Configurable quality and format (PNG, JPG, WebP)
- ✅ Wait for page load before capture
- ✅ Comprehensive error handling
- ✅ TypeScript support with full type definitions
- ✅ Industry-standard best practices

## Configuration Options

```typescript
interface ScreenshotConfig {
  useCORS?: boolean; // Enable CORS for external images (default: true)
  allowTaint?: boolean; // Allow tainted canvas (default: false)
  backgroundColor?: string | null; // Background color (default: '#ffffff')
  scale?: number; // Scale factor (default: window.devicePixelRatio)
  quality?: number; // Image quality 0-1 (default: 0.92)
  waitForLoad?: boolean; // Wait for page load (default: true)
  timeout?: number; // Max wait time in ms (default: 5000)
  logging?: boolean; // Enable console logging (default: false)
}
```

## Usage Examples

### Basic Screenshot

```typescript
import { ScreenshotCapture } from '@b3-crow/website-hook-sdk';

const capturer = new ScreenshotCapture();
const result = await capturer.capture();
console.log(`Screenshot: ${result.width}x${result.height}px`);
```

### Capture and Save

```typescript
const capturer = new ScreenshotCapture({ useCORS: true });

await capturer.captureAndSave(document.body, {
  filename: 'my-screenshot',
  format: 'png',
  quality: 0.92,
});
```

### Capture Specific Element

```typescript
const element = document.getElementById('my-element');
const result = await capturer.capture(element);
```

### Advanced Configuration

```typescript
const capturer = new ScreenshotCapture({
  useCORS: true,
  backgroundColor: '#ffffff',
  scale: 2, // 2x resolution
  quality: 0.95,
  waitForLoad: true,
  timeout: 10000, // 10 seconds
  logging: true, // Enable debug logs
});

const result = await capturer.capture();
await capturer.save(result, {
  filename: 'high-res-screenshot',
  format: 'jpg',
  quality: 0.95,
});
```

### Error Handling

```typescript
import {
  ScreenshotCapture,
  ScreenshotError,
  ScreenshotErrorType,
} from '@b3-crow/website-hook-sdk';

try {
  const capturer = new ScreenshotCapture();
  await capturer.captureAndSave();
} catch (error) {
  if (error instanceof ScreenshotError) {
    switch (error.type) {
      case ScreenshotErrorType.CORS_ERROR:
        console.error('CORS issue - enable useCORS option');
        break;
      case ScreenshotErrorType.TIMEOUT:
        console.error('Page load timeout');
        break;
      case ScreenshotErrorType.CAPTURE_FAILED:
        console.error('Capture failed:', error.message);
        break;
      default:
        console.error('Screenshot error:', error.message);
    }
  }
}
```

## Best Practices (Industry Standards)

### 1. Wait for Page Load

Always wait for the page to fully load before capturing:

```typescript
const capturer = new ScreenshotCapture({
  waitForLoad: true,
  timeout: 5000,
});
```

### 2. CORS Configuration

Enable CORS for external images:

```typescript
const capturer = new ScreenshotCapture({
  useCORS: true, // Required for external images
});
```

### 3. Performance Optimization

- Target specific elements instead of full page
- Use appropriate scale factor (avoid excessive resolution)
- Reduce DOM complexity before capture

```typescript
// Good: Capture specific element
const element = document.getElementById('content');
await capturer.capture(element);

// Avoid: Capturing huge pages unnecessarily
// await capturer.capture(document.body);
```

### 4. Quality vs File Size

Balance quality and file size:

```typescript
// High quality (larger file)
await capturer.save(result, {
  format: 'png',
  quality: 1.0,
});

// Balanced (recommended)
await capturer.save(result, {
  format: 'jpg',
  quality: 0.92,
});

// Smaller file
await capturer.save(result, {
  format: 'webp',
  quality: 0.8,
});
```

## Browser Compatibility

Supports all modern browsers:

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Opera: ✅ Full support
- IE11: ⚠️ Requires Promise polyfill

## Limitations

1. **Cross-Origin Images**: Requires CORS or proxy for external images
2. **Plugin Content**: Flash, Java applets won't render
3. **CSS Properties**: Limited support for cutting-edge CSS features
4. **DOM-Based**: Renders from DOM, not pixel-perfect screenshots
5. **Performance**: Large pages with many elements may be slow

## Security Considerations

1. **CORS Policy**: Respect same-origin policy
2. **Tainted Canvas**: Avoid `allowTaint: true` unless necessary
3. **User Privacy**: Don't capture sensitive user data
4. **File Size**: Validate file size before upload

## Performance Tips

1. **Target Specific Elements**: Capture only what you need
2. **Reduce DOM Complexity**: Fewer elements = faster capture
3. **Use Appropriate Scale**: Match device pixel ratio
4. **Optimize Images**: Compress before uploading
5. **Cache Results**: Don't capture repeatedly

## Testing

Open `example.html` in a browser to test the SDK:

```bash
# Serve the example file
python3 -m http.server 8000

# Or use any static server
npx serve .
```

Then open: http://localhost:8000/example.html

## API Reference

### ScreenshotCapture Class

#### Constructor

```typescript
constructor(config?: ScreenshotConfig)
```

#### Methods

##### capture(element?)

Captures screenshot of specified element or entire page.

```typescript
async capture(element?: HTMLElement): Promise<ScreenshotResult>
```

##### save(result, options?)

Saves screenshot to local file system (downloads).

```typescript
async save(result: ScreenshotResult, options?: SaveOptions): Promise<void>
```

##### captureAndSave(element?, saveOptions?)

Captures and saves in one operation.

```typescript
async captureAndSave(
  element?: HTMLElement,
  saveOptions?: SaveOptions
): Promise<ScreenshotResult>
```

##### updateConfig(config)

Updates configuration.

```typescript
updateConfig(config: Partial<ScreenshotConfig>): void
```

##### getConfig()

Gets current configuration.

```typescript
getConfig(): Readonly<Required<ScreenshotConfig>>
```

## Utility Functions

```typescript
import {
  waitForPageLoad,
  waitForImages,
  downloadFile,
  getImagesInElement,
  checkBrowserSupport,
  formatFileSize,
  generateTimestampFilename,
} from '@b3-crow/website-hook-sdk';
```

## Troubleshooting

### CORS Errors

```typescript
// Enable CORS
const capturer = new ScreenshotCapture({ useCORS: true });
```

### Blurry Images

```typescript
// Increase scale
const capturer = new ScreenshotCapture({
  scale: window.devicePixelRatio * 2,
});
```

### Timeout Errors

```typescript
// Increase timeout
const capturer = new ScreenshotCapture({
  timeout: 10000, // 10 seconds
});
```

### Missing Content

```typescript
// Ensure page is fully loaded
const capturer = new ScreenshotCapture({
  waitForLoad: true,
  timeout: 5000,
});
```

## Contributing

Found an issue? Please report it on [GitHub Issues](https://github.com/CROW-B3/website-hook-sdk/issues).

## License

MIT © CROW By B3
