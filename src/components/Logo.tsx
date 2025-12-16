import Image from 'next/image'
import Link from 'next/link'

type LogoProps = {
    href?: string
    className?: string
    imgClassName?: string
    priority?: boolean
}

const LOGO_SRC = 'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/0eb53f1f-0f3f-477c-b7bb-c79247655d53/floow_ai_logo.png'

/**
 * Centraliza el logo en un solo componente para mantener consistencia
 * y garantizar buen render en móvil y desktop.
 */
export default function Logo({ href = '/', className = '', imgClassName = 'h-10 w-auto', priority = false }: LogoProps) {
    const image = (
        <Image
            src={LOGO_SRC}
            alt="Floow AI"
            width={2400}
            height={1792}
            priority={priority}
            sizes="(max-width: 640px) 140px, (max-width: 1024px) 160px, 200px"
            className={`w-auto ${imgClassName}`}
        />
    )

    if (href) {
        return (
            <Link href={href} className={`inline-flex items-center ${className}`}>
                {image}
            </Link>
        )
    }

    return <div className={`inline-flex items-center ${className}`}>{image}</div>
}
