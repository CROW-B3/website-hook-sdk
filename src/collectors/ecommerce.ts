import type { Collector, CollectorContext } from './types';

export interface AddToCartData {
  productId: string;
  variantId?: string;
  quantity?: number;
  price?: number;
  currency?: string;
  [key: string]: any;
}

export interface VariantSelectData {
  productId: string;
  variantId: string;
  variantName?: string;
  variantValue?: string;
  price?: number;
  [key: string]: any;
}

export interface ImageZoomData {
  productId: string;
  imageUrl?: string;
  imageIndex?: number;
  zoomLevel?: number;
  [key: string]: any;
}

let collectorCtx: CollectorContext | null = null;

export function trackAddToCart(data: AddToCartData): void {
  if (!collectorCtx) {
    console.warn('[Crow] E-commerce collector not initialized');
    return;
  }
  collectorCtx.trackEvent('add_to_cart', data);
  collectorCtx.debug('Add to cart tracked', data);
}

export function trackVariantSelect(data: VariantSelectData): void {
  if (!collectorCtx) {
    console.warn('[Crow] E-commerce collector not initialized');
    return;
  }
  collectorCtx.trackEvent('variant_select', data);
  collectorCtx.debug('Variant select tracked', data);
}

export function trackImageZoom(data: ImageZoomData): void {
  if (!collectorCtx) {
    console.warn('[Crow] E-commerce collector not initialized');
    return;
  }
  collectorCtx.trackEvent('image_zoom', data);
  collectorCtx.debug('Image zoom tracked', data);
}

export function createEcommerceCollector(): Collector {
  return {
    name: 'ecommerce',

    initialize(context: CollectorContext): void {
      collectorCtx = context;
      context.debug('E-commerce collector initialized');
    },

    destroy(): void {
      collectorCtx = null;
    },
  };
}
