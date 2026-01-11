'use client'

interface StructuredDataProps {
    type?: 'product' | 'organization' | 'website' | 'faq'
    data?: any
}

export function ProductSchema() {
    const schema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Floow AI",
        "applicationCategory": "BusinessApplication",
        "description": "AI-powered UGC video generation platform for e-commerce and digital marketing",
        "operatingSystem": "Web",
        "offers": {
            "@type": "AggregateOffer",
            "lowPrice": "0",
            "highPrice": "249",
            "priceCurrency": "USD",
            "offerCount": "4"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "150",
            "bestRating": "5"
        },
        "url": "https://floow.ai",
        "screenshot": "https://floow.ai/screenshot.png"
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export function OrganizationSchema() {
    const schema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Floow AI",
        "url": "https://floow.ai",
        "logo": "https://floow.ai/logo.png",
        "description": "AI-powered platform for creating influencer-style product videos",
        "sameAs": [
            "https://twitter.com/floowai",
            "https://linkedin.com/company/floowai"
        ],
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "Customer Support",
            "email": "support@floow.ai"
        }
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export function WebsiteSchema() {
    const schema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Floow AI",
        "url": "https://floow.ai",
        "description": "Create AI UGC videos for your products",
        "potentialAction": {
            "@type": "SearchAction",
            "target": "https://floow.ai/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
        }
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export function FAQSchema({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
    const schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
            }
        }))
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

