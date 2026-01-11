'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
    Menu,
    X,
    Play,
    Check,
    ArrowRight,
    Globe,
    PenTool,
    User,
    Box,
    Video,
    Zap,
    Star
} from 'lucide-react'
import Logo from '@/components/Logo'
import { Market } from '@/lib/market'
import { getTranslations, formatCurrency } from '@/lib/i18n'

export default function MarketHome() {
    const params = useParams()
    const market = (params?.market as Market) || 'us'
    const t = getTranslations(market)
    
    return (
        <main className="min-h-screen bg-white selection:bg-indigo-100 selection:text-indigo-900">
            <Navbar market={market} t={t} />
            <Hero market={market} t={t} />
            <VideoCarousel />
            <SocialProof market={market} t={t} />
            <Steps market={market} t={t} />
            <ProductHolding market={market} t={t} />
            <Features market={market} t={t} />
            <Pricing market={market} t={t} />
            <CTA market={market} t={t} />
            <Footer market={market} t={t} />
        </main>
    )
}

// --- Components ---

const Navbar = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center">
                    <Logo className="h-10 w-auto" imgClassName="h-10" priority />

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-8">
                        <Link href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">{t.nav.features}</Link>
                        <Link href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">{t.nav.pricing}</Link>
                    </div>

                    <div className="hidden md:flex items-center space-x-4">
                        <Link href={`/${market}/login`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors">
                            {t.nav.login}
                        </Link>
                        <Link href={`/${market}/signup`} className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-all hover:scale-105">
                            {t.nav.startFree}
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-900 p-2">
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-white border-t border-gray-100 shadow-lg py-4 px-4 flex flex-col space-y-4">
                    <Link href="#features" className="text-base font-medium text-gray-900 py-2" onClick={() => setIsOpen(false)}>{t.nav.features}</Link>
                    <Link href="#pricing" className="text-base font-medium text-gray-900 py-2" onClick={() => setIsOpen(false)}>{t.nav.pricing}</Link>
                    <div className="h-px bg-gray-100 my-2"></div>
                    <Link href={`/${market}/login`} className="text-base font-medium text-gray-900 py-2" onClick={() => setIsOpen(false)}>{t.nav.login}</Link>
                    <Link href={`/${market}/signup`} className="bg-gray-900 text-white text-center py-3 rounded-lg font-medium" onClick={() => setIsOpen(false)}>
                        {t.nav.startFree}
                    </Link>
                </div>
            )}
        </nav>
    )
}

const Hero = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    return (
        <section className="pt-32 pb-8 md:pt-36 md:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="max-w-4xl mx-auto text-center">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
                    {t.hero.title} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{t.hero.titleHighlight}</span>.
                </h1>
                <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                    {t.hero.subtitle}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href={`/${market}/signup`} className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white rounded-full font-semibold text-lg hover:bg-gray-800 transition-all hover:scale-105 flex items-center justify-center">
                        {t.hero.ctaPrimary}
                    </Link>
                    <Link href={`/${market}/login`} className="sm:hidden w-full px-8 py-4 bg-white border border-gray-200 text-gray-900 rounded-full font-semibold text-lg hover:bg-gray-50 transition-all flex items-center justify-center">
                        {t.hero.ctaLogin}
                    </Link>
                </div>
            </div>
        </section>
    )
}

const VideoCarousel = () => {
    const videoUrls = [
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6630c6385efed4bdfef33_8video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6630c8c31eceed99f724b_7video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6630c8d1979fc73d3d3f5_10video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6630cb269521cdab066c2_5video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6630cb5c0ec07b48221b3_6video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6630ccef00c08f42535c4_9video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6630cf2bebfaf8ed505a3_3video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6630cf74d4f7c8809bd0b_11video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6636285cf3cb4d1edcd0c_2video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6645cbb1e4132dcc172db_video.webp',
        'https://nxdfwseqxdtfghaxvrwp.supabase.co/storage/v1/object/public/assets%20web/68e6647328fdc175188398f1_4video.webp',
    ]

    const duplicatedVideos = [...videoUrls, ...videoUrls]

    return (
        <div className="w-full overflow-hidden bg-white py-12">
            <div className="flex gap-4 animate-scroll-infinite">
                {duplicatedVideos.map((url, i) => (
                    <div key={i} className="flex-none w-[200px] md:w-[280px] aspect-[9/16] bg-white rounded-xl shadow-md overflow-hidden relative group cursor-pointer hover:-translate-y-2 transition-transform duration-300">
                        <img
                            src={url}
                            alt={`Video preview ${i + 1}`}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <Play className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" size={48} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const SocialProof = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    return (
        <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                        {market === 'us' ? 'Join +1,000 brands going viral' : 'Únete a +1,000 marcas que se hacen virales'}
                    </h2>
                </div>

                <div className="max-w-4xl mx-auto bg-gray-50 rounded-2xl p-8 md:p-12 relative mb-16">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full mb-6 flex items-center justify-center text-2xl">👩‍💼</div>
                        <p className="text-xl md:text-2xl text-gray-800 font-medium mb-6 leading-relaxed">
                            {market === 'us' 
                                ? '"AnunciosUGC has transformed the way we create content. We now generate ready-for-social videos in minutes and they look like they cost thousands of dollars."'
                                : '"AnunciosUGC ha cambiado nuestra forma de crear contenido. Ahora generamos videos listos para redes en minutos y parecen costar miles de dólares."'
                            }
                        </p>
                        <div>
                            <p className="font-bold text-gray-900">Emily Radford</p>
                            <p className="text-gray-500 text-sm">{market === 'us' ? 'Head of Social Content' : 'Directora de Contenido Social'}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                            <Star className="text-green-600" size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{market === 'us' ? 'Customer satisfaction' : 'Satisfacción del cliente'}</h3>
                        <p className="text-gray-500 text-sm">{market === 'us' ? 'Rated by 1000+ active users' : 'Valorado por 1000+ usuarios activos'}</p>
                    </div>
                    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                            <Zap className="text-blue-600" size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{market === 'us' ? 'Ease of use' : 'Facilidad de uso'}</h3>
                        <p className="text-gray-500 text-sm">{market === 'us' ? 'Average creation time: 2.5 min' : 'Tiempo medio de creación: 2.5 min'}</p>
                    </div>
                    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                            <Box className="text-purple-600" size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{market === 'us' ? 'Cost savings' : 'Ahorro de costes'}</h3>
                        <p className="text-gray-500 text-sm">{market === 'us' ? 'Compared to traditional UGC' : 'Comparado con UGC tradicional'}</p>
                    </div>
                </div>
            </div>
        </section>
    )
}

const Steps = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    return (
        <section className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t.steps.title}</h2>
                    <p className="text-lg text-gray-600">{t.steps.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 group">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <User className="text-indigo-600" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{t.steps.step1Title}</h3>
                            <p className="text-gray-500">{t.steps.step1Desc}</p>
                        </div>
                        <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden relative">
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">Preview UI</div>
                        </div>
                    </div>

                    <div className="bg-gray-900 text-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 transform md:-translate-y-4">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                                <PenTool className="text-white" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t.steps.step2Title}</h3>
                            <p className="text-gray-400">{t.steps.step2Desc}</p>
                        </div>
                        <div className="aspect-[4/3] bg-gray-800 rounded-xl overflow-hidden relative border border-gray-700">
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500">Script UI</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 group">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Video className="text-indigo-600" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{t.steps.step3Title}</h3>
                            <p className="text-gray-500">{t.steps.step3Desc}</p>
                        </div>
                        <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden relative">
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">Video Result</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

const ProductHolding = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    return (
        <section className="py-20 bg-white overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
                <div className="max-w-3xl">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        {market === 'us' ? 'Product Holding' : 'Sujeción de producto'}
                    </h2>
                    <p className="text-lg text-gray-600">
                        {market === 'us' 
                            ? 'Let AI creators hold and showcase your product like real people.'
                            : 'Deja que los creadores IA sostengan y destaquen tu producto como personas reales.'
                        }
                    </p>
                </div>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-8 px-4 sm:px-6 lg:px-8 no-scrollbar">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex-none w-[300px] aspect-square bg-gray-100 rounded-2xl overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">
                            {market === 'us' ? `Product Demo ${i}` : `Producto Demo ${i}`}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

const Features = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    const features = [
        {
            title: t.features.avatarSelection,
            desc: market === 'us' 
                ? 'Choose from +100 unique AI actors to represent your brand and give it visual identity.'
                : 'Elige entre +100 actores IA únicos para representar tu marca y darle identidad visual.',
            icon: User,
            colSpan: "md:col-span-2"
        },
        {
            title: t.features.productHolding,
            desc: market === 'us'
                ? 'From demos to testimonials, AI actors bring your brand to life by holding your product.'
                : 'Desde demos hasta testimonios, los actores IA dan vida a tu marca sosteniendo tu producto.',
            icon: Box,
            colSpan: "md:col-span-1"
        },
        {
            title: t.features.talkingHead,
            desc: market === 'us'
                ? 'No waiting for creators. Produce unlimited reliable content ready in 2 minutes.'
                : 'Sin esperar a creadores. Produce contenido ilimitado confiable y listo en 2 minutos.',
            icon: Video,
            colSpan: "md:col-span-1"
        },
        {
            title: t.features.languages,
            desc: market === 'us'
                ? 'Reach global audiences with UGC in native language in one click.'
                : 'Llega a audiencias globales con UGC en idioma nativo en un clic.',
            icon: Globe,
            colSpan: "md:col-span-2"
        },
        {
            title: t.features.scriptWriter,
            desc: market === 'us'
                ? 'Generate scroll-stopping hooks and high-conversion scripts.'
                : 'Genera ganchos que detienen el scroll y guiones de alta conversión.',
            icon: PenTool,
            colSpan: "md:col-span-3"
        }
    ]

    return (
        <section id="features" className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12">
                    {t.features.title}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature, idx) => (
                        <div key={idx} className={`${feature.colSpan} bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow`}>
                            <div className="flex flex-col h-full justify-between">
                                <div className="mb-8">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                                        <feature.icon className="text-indigo-600" size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                                    <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                                </div>
                                <div className="w-full h-48 bg-gray-100 rounded-xl overflow-hidden relative">
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Feature Preview</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

const Pricing = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    const [annual, setAnnual] = useState(false) // Default to monthly

    // Real pricing data by market (monthly and annual)
    const pricingData: Record<Market, { 
        starter: { monthly: number; annual: number };
        growth: { monthly: number; annual: number };
        agency: { monthly: number; annual: number };
    }> = {
        us: { 
            starter: { monthly: 45, annual: 450 },
            growth: { monthly: 99, annual: 990 },
            agency: { monthly: 249, annual: 2490 }
        },
        es: { 
            starter: { monthly: 39, annual: 390 },
            growth: { monthly: 99, annual: 990 },
            agency: { monthly: 229, annual: 2229 }
        },
        mx: { 
            starter: { monthly: 795, annual: 7950 },
            growth: { monthly: 1995, annual: 19950 },
            agency: { monthly: 4495, annual: 44950 }
        },
    }

    const prices = pricingData[market]

    return (
        <section id="pricing" className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900">{t.pricing.title}</h2>

                    <div className="flex items-center bg-gray-100 p-1 rounded-full">
                        <button
                            onClick={() => setAnnual(false)}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${!annual ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                        >
                            {t.pricing.monthly}
                        </button>
                        <button
                            onClick={() => setAnnual(true)}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${annual ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                        >
                            {t.pricing.annual}
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t.pricing.annualSave}</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Starter */}
                    <div className="border border-gray-200 rounded-2xl p-8 hover:border-indigo-200 transition-colors">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Starter</h3>
                        <div className="mb-6">
                            <div className="flex items-baseline">
                                <span className="text-4xl font-bold text-gray-900">
                                    {formatCurrency(annual ? prices.starter.annual / 12 : prices.starter.monthly, market, { showDecimals: false })}
                                </span>
                                <span className="text-gray-500 ml-2">{t.pricing.perMonth}</span>
                            </div>
                            {annual && (
                                <p className="text-sm text-green-600 mt-1">
                                    {formatCurrency(prices.starter.annual, market, { showDecimals: false })} {market === 'us' ? 'billed annually' : 'facturado anualmente'}
                                </p>
                            )}
                        </div>
                        <ul className="space-y-4 mb-8">
                            <li className="flex items-center gap-3 text-gray-600">
                                <Check size={18} className="text-indigo-600" /> 550 {t.pricing.credits}
                            </li>
                            <li className="flex items-center gap-3 text-gray-600">
                                <Check size={18} className="text-indigo-600" /> 27 {t.pricing.videos}
                            </li>
                            <li className="flex items-center gap-3 text-gray-600">
                                <Check size={18} className="text-indigo-600" /> 550 {t.pricing.images}
                            </li>
                        </ul>
                        <Link href={`/${market}/signup`} className="block w-full py-3 px-4 bg-white border-2 border-gray-900 text-gray-900 rounded-xl font-bold text-center hover:bg-gray-50 transition-colors">
                            {t.pricing.tryFreeTrial}
                        </Link>
                    </div>

                    {/* Growth */}
                    <div className="border-2 border-indigo-600 rounded-2xl p-8 relative shadow-xl bg-white transform md:-translate-y-4">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                            {t.pricing.mostPopular}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Growth</h3>
                        <div className="mb-6">
                            <div className="flex items-baseline">
                                <span className="text-4xl font-bold text-gray-900">
                                    {formatCurrency(annual ? prices.growth.annual / 12 : prices.growth.monthly, market, { showDecimals: false })}
                                </span>
                                <span className="text-gray-500 ml-2">{t.pricing.perMonth}</span>
                            </div>
                            {annual && (
                                <p className="text-sm text-green-600 mt-1">
                                    {formatCurrency(prices.growth.annual, market, { showDecimals: false })} {market === 'us' ? 'billed annually' : 'facturado anualmente'}
                                </p>
                            )}
                        </div>
                        <ul className="space-y-4 mb-8">
                            <li className="flex items-center gap-3 text-gray-900 font-medium">
                                <Check size={18} className="text-indigo-600" /> 1200 {t.pricing.credits}
                            </li>
                            <li className="flex items-center gap-3 text-gray-900 font-medium">
                                <Check size={18} className="text-indigo-600" /> 60 {t.pricing.videos}
                            </li>
                            <li className="flex items-center gap-3 text-gray-900 font-medium">
                                <Check size={18} className="text-indigo-600" /> 1200 {t.pricing.images}
                            </li>
                        </ul>
                        <Link href={`/${market}/signup`} className="block w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold text-center hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl">
                            {t.pricing.tryFreeTrial}
                        </Link>
                    </div>

                    {/* Agency */}
                    <div className="border border-gray-200 rounded-2xl p-8 hover:border-indigo-200 transition-colors">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Agency</h3>
                        <div className="mb-6">
                            <div className="flex items-baseline">
                                <span className="text-4xl font-bold text-gray-900">
                                    {formatCurrency(annual ? prices.agency.annual / 12 : prices.agency.monthly, market, { showDecimals: false })}
                                </span>
                                <span className="text-gray-500 ml-2">{t.pricing.perMonth}</span>
                            </div>
                            {annual && (
                                <p className="text-sm text-green-600 mt-1">
                                    {formatCurrency(prices.agency.annual, market, { showDecimals: false })} {market === 'us' ? 'billed annually' : 'facturado anualmente'}
                                </p>
                            )}
                        </div>
                        <ul className="space-y-4 mb-8">
                            <li className="flex items-center gap-3 text-gray-600">
                                <Check size={18} className="text-indigo-600" /> 2500 {t.pricing.credits}
                            </li>
                            <li className="flex items-center gap-3 text-gray-600">
                                <Check size={18} className="text-indigo-600" /> 125 {t.pricing.videos}
                            </li>
                            <li className="flex items-center gap-3 text-gray-600">
                                <Check size={18} className="text-indigo-600" /> 2500 {t.pricing.images}
                            </li>
                        </ul>
                        <Link href={`/${market}/signup`} className="block w-full py-3 px-4 bg-white border-2 border-gray-900 text-gray-900 rounded-xl font-bold text-center hover:bg-gray-50 transition-colors">
                            {t.pricing.tryFreeTrial}
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}

const CTA = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    return (
        <section className="py-20 bg-gray-900 text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50"></div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                    <div className="max-w-2xl">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">
                            {market === 'us' 
                                ? 'Create your AI Influencer in minutes'
                                : 'Crea tu Influencer IA en minutos'
                            }
                        </h2>
                        <p className="text-xl text-gray-300 mb-8">
                            {market === 'us'
                                ? 'Create the perfect face for your brand in minutes, with custom uploads or +100 licensed AI actors.'
                                : 'Crea la cara perfecta para tu marca en minutos, con subidas personalizadas o +100 actores IA licenciados.'
                            }
                        </p>
                        <Link href={`/${market}/signup`} className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors">
                            {t.hero.ctaPrimary} <ArrowRight size={20} />
                        </Link>
                    </div>
                    <div className="relative">
                        <div className="w-64 h-64 md:w-80 md:h-80 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-3xl opacity-30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="relative bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-indigo-500 rounded-full"></div>
                                <div>
                                    <div className="h-4 w-32 bg-white/20 rounded mb-2"></div>
                                    <div className="h-3 w-20 bg-white/10 rounded"></div>
                                </div>
                            </div>
                            <div className="h-32 w-full bg-black/20 rounded-xl"></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

const Footer = ({ market, t }: { market: Market; t: ReturnType<typeof getTranslations> }) => {
    return (
        <footer className="bg-white border-t border-gray-100 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <Logo className="h-8 w-auto" imgClassName="h-8" />

                    <div className="flex gap-8">
                        <Link href={`/${market}/demo`} className="text-sm text-gray-600 hover:text-gray-900">Demo</Link>
                        <Link href="#features" className="text-sm text-gray-600 hover:text-gray-900">{t.nav.features}</Link>
                        <Link href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">{t.nav.pricing}</Link>
                    </div>
                </div>

                <div className="border-t border-gray-100 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">© 2025 AnunciosUGC. {market === 'us' ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
                    <div className="flex gap-6">
                        <Link href={`/${market}/privacy`} className="text-sm text-gray-500 hover:text-gray-900">
                            {market === 'us' ? 'Privacy Policy' : 'Política de Privacidad'}
                        </Link>
                        <Link href={`/${market}/terms`} className="text-sm text-gray-500 hover:text-gray-900">
                            {market === 'us' ? 'Terms of Service' : 'Términos de Servicio'}
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}

