import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/api/', '/auth/', '/dashboard/'],
      },
    ],
    sitemap: 'https://floow.ai/sitemap.xml',
  }
}

