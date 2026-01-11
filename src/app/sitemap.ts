import { MetadataRoute } from 'next'
import { VALID_MARKETS } from '@/lib/market'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://floow.ai'
  
  // Landing pages por mercado
  const marketPages = VALID_MARKETS.flatMap((market) => [
    {
      url: `${baseUrl}/${market}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/${market}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/${market}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
  ])

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...marketPages,
  ]
}

