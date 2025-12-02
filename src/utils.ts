/**
 * Utility functions for screenshot capture
 */

/**
 * Wait for page to fully load including all resources
 *
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise that resolves when page is loaded or rejects on timeout
 */
export function waitForPageLoad(timeout: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    // If page is already loaded
    if (document.readyState === 'complete') {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      window.removeEventListener('load', onLoad);
      reject(new Error('Page load timeout'));
    }, timeout);

    const onLoad = () => {
      clearTimeout(timeoutId);
      resolve();
    };

    window.addEventListener('load', onLoad);
  });
}

/**
 * Wait for specific images to load
 *
 * @param images - Array of image elements
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise that resolves when all images are loaded
 */
export function waitForImages(
  images: HTMLImageElement[],
  timeout: number = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Image load timeout'));
    }, timeout);

    const loadPromises = images.map(
      img =>
        new Promise<void>(resolveImg => {
          if (img.complete) {
            resolveImg();
          } else {
            img.addEventListener('load', () => resolveImg());
            img.addEventListener('error', () => resolveImg()); // Resolve even on error
          }
        })
    );

    Promise.all(loadPromises)
      .then(() => {
        clearTimeout(timeoutId);
        resolve();
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Download a file to the user's local file system
 *
 * @param blob - Blob or File to download
 * @param filename - Name for the downloaded file
 */
export function downloadFile(blob: Blob, filename: string): void {
  // Create object URL
  const url = URL.createObjectURL(blob);

  // Create temporary anchor element
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Get all images in an element
 *
 * @param element - Root element to search
 * @returns Array of image elements
 */
export function getImagesInElement(element: HTMLElement): HTMLImageElement[] {
  return Array.from(element.querySelectorAll('img'));
}

/**
 * Check if browser supports required features
 *
 * @returns Object with support flags
 */
export function checkBrowserSupport(): {
  canvas: boolean;
  blob: boolean;
  download: boolean;
} {
  return {
    canvas: !!document.createElement('canvas').getContext,
    blob: typeof Blob !== 'undefined' && typeof URL !== 'undefined',
    download: 'download' in document.createElement('a'),
  };
}

/**
 * Format file size in human-readable format
 *
 * @param bytes - Size in bytes
 * @returns Formatted string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Generate timestamp-based filename
 *
 * @param prefix - Filename prefix
 * @param extension - File extension
 * @returns Formatted filename
 */
export function generateTimestampFilename(
  prefix: string = 'screenshot',
  extension: string = 'png'
): string {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}-${timestamp}.${extension}`;
}
