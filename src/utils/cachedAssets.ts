// Cached assets for improved PDF generation performance
interface CachedAsset {
  data: string;
  timestamp: number;
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const assetCache = new Map<string, CachedAsset>();

export class CachedAssets {
  static async getLogoAsBase64(logoUrl: string): Promise<string | null> {
    if (!logoUrl) return null;
    
    // Check cache first
    const cached = assetCache.get(logoUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    
    try {
      const response = await fetch(logoUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Cache the base64 data
          assetCache.set(logoUrl, {
            data: result,
            timestamp: Date.now()
          });
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Failed to cache logo as base64:', error);
      return null;
    }
  }
  
  static clearCache(): void {
    assetCache.clear();
  }
  
  static getCacheSize(): number {
    return assetCache.size;
  }
}