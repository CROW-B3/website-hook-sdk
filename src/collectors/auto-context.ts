import type { Collector, CollectorContext } from './types';

interface ExtractedProductData {
  source: 'json-ld' | 'opengraph' | 'meta';
  productId?: string;
  name?: string;
  price?: number;
  currency?: string;
  availability?: string;
  brand?: string;
  category?: string;
  description?: string;
  image?: string;
  url?: string;
  sku?: string;
  [key: string]: any;
}

const URL_POLL_INTERVAL_MS = 2000;
const EXTRACTION_TIMEOUT_MS = 3000;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TEXT_LENGTH = 200;

function mapJsonLdToProductData(item: any): ExtractedProductData {
  const offers = item.offers;
  let price: number | undefined;
  let currency: string | undefined;
  let availability: string | undefined;

  if (offers) {
    const offer = Array.isArray(offers) ? offers[0] : offers;
    price = parseFloat(offer.price) || undefined;
    currency = offer.priceCurrency || undefined;
    availability =
      offer.availability?.replace('https://schema.org/', '') || undefined;
  }

  return {
    source: 'json-ld',
    productId: item.sku || item.productID || item.identifier || undefined,
    name: item.name || undefined,
    price,
    currency,
    availability,
    brand: typeof item.brand === 'string' ? item.brand : item.brand?.name,
    category: item.category || undefined,
    description:
      item.description?.substring(0, MAX_DESCRIPTION_LENGTH) || undefined,
    image: typeof item.image === 'string' ? item.image : item.image?.[0],
    url: item.url || undefined,
    sku: item.sku || undefined,
  };
}

function extractJsonLdProducts(): ExtractedProductData[] {
  const results: ExtractedProductData[] = [];
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (
          item['@type'] === 'Product' ||
          item['@type']?.includes?.('Product')
        ) {
          results.push(mapJsonLdToProductData(item));
        }

        if (item['@graph'] && Array.isArray(item['@graph'])) {
          for (const graphItem of item['@graph']) {
            if (graphItem['@type'] === 'Product') {
              results.push(mapJsonLdToProductData(graphItem));
            }
          }
        }
      }
    } catch {
      // Malformed JSON-LD, skip
    }
  }

  return results;
}

function extractOpenGraphProduct(): ExtractedProductData | null {
  function getMeta(property: string): string | null {
    const el = document.querySelector(`meta[property="${property}"]`);
    return el?.getAttribute('content') || null;
  }

  const title = getMeta('og:title');
  const ogType = getMeta('og:type');
  const priceAmount =
    getMeta('og:price:amount') || getMeta('product:price:amount');
  const priceCurrency =
    getMeta('og:price:currency') || getMeta('product:price:currency');

  if (!title && !priceAmount) return null;
  if (ogType && !ogType.includes('product')) return null;

  const price = priceAmount ? parseFloat(priceAmount) : undefined;

  return {
    source: 'opengraph',
    name: title || undefined,
    price: isNaN(price as number) ? undefined : price,
    currency: priceCurrency || undefined,
    availability: getMeta('product:availability') || undefined,
    brand: getMeta('product:brand') || undefined,
    category: getMeta('product:category') || undefined,
    image: getMeta('og:image') || undefined,
    url: getMeta('og:url') || undefined,
  };
}

function extractStandardMeta(): ExtractedProductData | null {
  function getMeta(name: string): string | null {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el?.getAttribute('content') || null;
  }

  const productId = getMeta('product:id') || getMeta('product-id');
  const productName = getMeta('product:name') || getMeta('product-name');
  const productPrice = getMeta('product:price') || getMeta('product-price');

  if (!productId && !productName && !productPrice) return null;

  return {
    source: 'meta',
    productId: productId || undefined,
    name: productName?.substring(0, MAX_TEXT_LENGTH) || undefined,
    price: productPrice ? parseFloat(productPrice) : undefined,
  };
}

function deduplicateProducts(
  products: ExtractedProductData[]
): ExtractedProductData[] {
  if (products.length <= 1) return products;

  const jsonLd = products.filter((p) => p.source === 'json-ld');
  if (jsonLd.length > 0) return jsonLd;

  const og = products.filter((p) => p.source === 'opengraph');
  if (og.length > 0) return og;

  return products;
}

function extractAllProductData(): ExtractedProductData[] {
  const all: ExtractedProductData[] = [];

  all.push(...extractJsonLdProducts());

  const og = extractOpenGraphProduct();
  if (og) all.push(og);

  const meta = extractStandardMeta();
  if (meta) all.push(meta);

  return deduplicateProducts(all);
}

function hashProducts(products: ExtractedProductData[]): string {
  return JSON.stringify(
    products.map((p) => ({
      id: p.productId,
      name: p.name,
      price: p.price,
      source: p.source,
    }))
  );
}

export function createAutoContextCollector(): Collector {
  let ctx: CollectorContext | null = null;
  let lastExtractedUrl = '';
  let lastExtractedHash = '';
  let urlPollTimer: number | null = null;
  let lastPolledUrl = '';

  function attemptExtraction(): void {
    if (!ctx) return;

    const currentUrl = window.location.href;
    const products = extractAllProductData();

    if (products.length === 0) return;

    const currentHash = hashProducts(products);

    if (currentUrl === lastExtractedUrl && currentHash === lastExtractedHash)
      return;

    lastExtractedUrl = currentUrl;
    lastExtractedHash = currentHash;

    for (const product of products) {
      ctx.trackEvent('context_snapshot', {
        ...product,
        autoDetected: true,
        extractedUrl: currentUrl,
      });
    }

    ctx.debug('Auto-context: product data extracted', {
      count: products.length,
      url: currentUrl,
    });
  }

  function scheduleExtraction(): void {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => attemptExtraction(), {
        timeout: EXTRACTION_TIMEOUT_MS,
      });
    } else {
      setTimeout(attemptExtraction, 1000);
    }
  }

  function startUrlPolling(): void {
    lastPolledUrl = window.location.href;
    urlPollTimer = window.setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastPolledUrl) {
        lastPolledUrl = currentUrl;
        scheduleExtraction();
      }
    }, URL_POLL_INTERVAL_MS);
  }

  function stopUrlPolling(): void {
    if (urlPollTimer !== null) {
      window.clearInterval(urlPollTimer);
      urlPollTimer = null;
    }
  }

  return {
    name: 'auto-context',

    initialize(context: CollectorContext): void {
      ctx = context;

      startUrlPolling();
      scheduleExtraction();

      ctx.debug('Auto-context collector initialized');
    },

    destroy(): void {
      stopUrlPolling();
      ctx = null;
    },
  };
}
