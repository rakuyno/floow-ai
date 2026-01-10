/**
 * Internationalization (i18n) System
 * 
 * Provides localized strings and currency formatting for all markets
 */

import { Market, MARKET_CONFIG, type Currency, type Locale } from './market';

/**
 * Translation keys used throughout the app
 */
export interface Translations {
    // Navigation
    nav: {
        features: string;
        pricing: string;
        login: string;
        signup: string;
        startFree: string;
    };
    
    // Hero section
    hero: {
        title: string;
        titleHighlight: string;
        subtitle: string;
        ctaPrimary: string;
        ctaLogin: string;
    };
    
    // Pricing
    pricing: {
        title: string;
        monthly: string;
        annual: string;
        annualSave: string;
        perMonth: string;
        tryFreeTrial: string;
        choosePlan: string;
        mostPopular: string;
        credits: string;
        videos: string;
        images: string;
        withWatermark: string;
        noWatermark: string;
        prioritySupport: string;
    };
    
    // Common
    common: {
        free: string;
        loading: string;
        error: string;
        success: string;
        cancel: string;
        continue: string;
        save: string;
    };
    
    // Features
    features: {
        title: string;
        avatarSelection: string;
        productHolding: string;
        talkingHead: string;
        languages: string;
        scriptWriter: string;
    };
    
    // Steps
    steps: {
        title: string;
        subtitle: string;
        step1Title: string;
        step1Desc: string;
        step2Title: string;
        step2Desc: string;
        step3Title: string;
        step3Desc: string;
    };
}

/**
 * English translations (US market)
 */
const EN_TRANSLATIONS: Translations = {
    nav: {
        features: 'Features',
        pricing: 'Pricing',
        login: 'Log in',
        signup: 'Sign up',
        startFree: 'Start free',
    },
    hero: {
        title: 'Create AI UGC videos that',
        titleHighlight: 'look real',
        subtitle: 'Generate influencer-style videos where AI avatars hold and talk about your products. Ready for TikTok, Reels, and Ads in less than 3 minutes.',
        ctaPrimary: 'Try for free',
        ctaLogin: 'Log in',
    },
    pricing: {
        title: 'Pricing',
        monthly: 'Monthly',
        annual: 'Annual',
        annualSave: '-30%',
        perMonth: '/month',
        tryFreeTrial: 'Try 1 day free',
        choosePlan: 'Choose Plan',
        mostPopular: 'Most Popular',
        credits: 'credits',
        videos: 'videos',
        images: 'images',
        withWatermark: 'With Watermark',
        noWatermark: 'No Watermark',
        prioritySupport: 'Priority Support',
    },
    common: {
        free: 'Free',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        continue: 'Continue',
        save: 'Save',
    },
    features: {
        title: 'Create winning creatives with these features',
        avatarSelection: 'Avatar Selection',
        productHolding: 'AI holds your product',
        talkingHead: 'Talking Head Video',
        languages: 'Access to +35 languages',
        scriptWriter: 'Script Writer',
    },
    steps: {
        title: 'You\'re 3 clicks away',
        subtitle: 'Create winning social content or ad creatives in minutes',
        step1Title: '1. Choose an actor',
        step1Desc: 'Clone yourself or select one of our AI actors.',
        step2Title: '2. Write the script',
        step2Desc: 'Write your script or upload an audio file.',
        step3Title: '3. Generate your video',
        step3Desc: 'Your video is generated in a few minutes.',
    },
};

/**
 * Spanish (Spain) translations (ES market)
 */
const ES_ES_TRANSLATIONS: Translations = {
    nav: {
        features: 'Características',
        pricing: 'Precios',
        login: 'Iniciar sesión',
        signup: 'Registrarse',
        startFree: 'Empezar gratis',
    },
    hero: {
        title: 'Crea videos UGC con IA que',
        titleHighlight: 'parecen reales',
        subtitle: 'Genera videos estilo influencer donde avatares IA sostienen y hablan de tus productos. Listos para TikTok, Reels y Ads en menos de 3 minutos.',
        ctaPrimary: 'Prueba gratis',
        ctaLogin: 'Iniciar sesión',
    },
    pricing: {
        title: 'Precios',
        monthly: 'Mensual',
        annual: 'Anual',
        annualSave: '-30%',
        perMonth: '/mes',
        tryFreeTrial: 'Prueba 1 día gratis',
        choosePlan: 'Elegir Plan',
        mostPopular: 'Más Popular',
        credits: 'créditos',
        videos: 'vídeos',
        images: 'imágenes',
        withWatermark: 'Con Marca de Agua',
        noWatermark: 'Sin Marca de Agua',
        prioritySupport: 'Soporte Prioritario',
    },
    common: {
        free: 'Gratis',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        cancel: 'Cancelar',
        continue: 'Continuar',
        save: 'Guardar',
    },
    features: {
        title: 'Crea creativos ganadores con estas funciones',
        avatarSelection: 'Selección de avatar',
        productHolding: 'IA sostiene tu producto',
        talkingHead: 'Video Talking Head',
        languages: 'Acceso a +35 idiomas',
        scriptWriter: 'Escritor de guiones',
    },
    steps: {
        title: 'Estás a 3 clics de distancia',
        subtitle: 'Crea contenido social ganador o creativos publicitarios en minutos',
        step1Title: '1. Elige un actor',
        step1Desc: 'Clónate a ti mismo o selecciona uno de nuestros actores IA.',
        step2Title: '2. Escribe el guion',
        step2Desc: 'Escribe tu guion o sube un archivo de audio.',
        step3Title: '3. Genera tu video',
        step3Desc: 'Tu video se genera en unos pocos minutos.',
    },
};

/**
 * Spanish (Mexico) translations (MX market)
 */
const ES_MX_TRANSLATIONS: Translations = {
    nav: {
        features: 'Características',
        pricing: 'Precios',
        login: 'Iniciar sesión',
        signup: 'Registrarse',
        startFree: 'Empezar gratis',
    },
    hero: {
        title: 'Crea videos UGC con IA que',
        titleHighlight: 'parecen reales',
        subtitle: 'Genera videos estilo influencer donde avatares IA sostienen y hablan de tus productos. Listos para TikTok, Reels y Ads en menos de 3 minutos.',
        ctaPrimary: 'Prueba gratis',
        ctaLogin: 'Iniciar sesión',
    },
    pricing: {
        title: 'Precios',
        monthly: 'Mensual',
        annual: 'Anual',
        annualSave: '-30%',
        perMonth: '/mes',
        tryFreeTrial: 'Prueba 1 día gratis',
        choosePlan: 'Elegir Plan',
        mostPopular: 'Más Popular',
        credits: 'créditos',
        videos: 'videos',
        images: 'imágenes',
        withWatermark: 'Con Marca de Agua',
        noWatermark: 'Sin Marca de Agua',
        prioritySupport: 'Soporte Prioritario',
    },
    common: {
        free: 'Gratis',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        cancel: 'Cancelar',
        continue: 'Continuar',
        save: 'Guardar',
    },
    features: {
        title: 'Crea creativos ganadores con estas funciones',
        avatarSelection: 'Selección de avatar',
        productHolding: 'IA sostiene tu producto',
        talkingHead: 'Video Talking Head',
        languages: 'Acceso a +35 idiomas',
        scriptWriter: 'Escritor de guiones',
    },
    steps: {
        title: 'Estás a 3 clics de distancia',
        subtitle: 'Crea contenido social ganador o creativos publicitarios en minutos',
        step1Title: '1. Elige un actor',
        step1Desc: 'Clónate a ti mismo o selecciona uno de nuestros actores IA.',
        step2Title: '2. Escribe el guion',
        step2Desc: 'Escribe tu guion o sube un archivo de audio.',
        step3Title: '3. Genera tu video',
        step3Desc: 'Tu video se genera en unos pocos minutos.',
    },
};

/**
 * Translation dictionary by locale
 */
const TRANSLATIONS: Record<Locale, Translations> = {
    'en': EN_TRANSLATIONS,
    'es-ES': ES_ES_TRANSLATIONS,
    'es-MX': ES_MX_TRANSLATIONS,
};

/**
 * Gets translations for a given market
 */
export function getTranslations(market: Market): Translations {
    const locale = MARKET_CONFIG[market].locale;
    return TRANSLATIONS[locale];
}

/**
 * Formats a number as currency for the given market
 */
export function formatCurrency(
    amount: number,
    market: Market,
    options?: {
        showDecimals?: boolean;
        compact?: boolean;
    }
): string {
    const { locale, currency } = MARKET_CONFIG[market];
    
    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: options?.showDecimals !== false ? 2 : 0,
        maximumFractionDigits: options?.showDecimals !== false ? 2 : 0,
        notation: options?.compact ? 'compact' : 'standard',
    });
    
    return formatter.format(amount);
}

/**
 * Formats a number with locale-specific formatting
 */
export function formatNumber(
    value: number,
    market: Market,
    options?: Intl.NumberFormatOptions
): string {
    const { locale } = MARKET_CONFIG[market];
    return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Gets the currency symbol for a market
 */
export function getCurrencySymbol(market: Market): string {
    const { currency } = MARKET_CONFIG[market];
    
    const symbols: Record<Currency, string> = {
        USD: '$',
        EUR: '€',
        MXN: '$',
    };
    
    return symbols[currency];
}

/**
 * Converts cents to currency string
 */
export function centsToAmount(cents: number, market: Market): string {
    return formatCurrency(cents / 100, market);
}

