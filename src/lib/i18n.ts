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
        dashboard: string;
        createAd: string;
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
        billedAnnually: string;
        processing: string;
        subtitle: string;
        upgradePlan: string;
        save: string;
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
        search: string;
        close: string;
        open: string;
        back: string;
        next: string;
        submit: string;
        tokens: string;
        scenes: string;
        english: string;
        spanish: string;
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

    // App Header
    header: {
        upgradePlan: string;
        billing: string;
        signOut: string;
    };

    // Dashboard
    dashboard: {
        title: string;
        newAd: string;
        searchPlaceholder: string;
        searchButton: string;
        noAds: string;
        draft: string;
        generated: string;
        failed: string;
        processing: string;
        continueButton: string;
        openButton: string;
        created: string;
        status: string;
        cost: string;
        reference: string;
        actions: string;
        showing: string;
        of: string;
        page: string;
        previous: string;
        next: string;
        download: string;
        downloadWatermark: string;
        removeWatermark: string;
        untitled: string;
    };

    // Errors
    errors: {
        blockedSafety: string;
        insufficientTokens: string;
        serviceTimeout: string;
        videoGenerationFailed: string;
        reasonDetected: string;
        authError: string;
        loadBalanceError: string;
        noBalanceRecord: string;
        unexpectedError: string;
    };

    // Auth (Login/Signup)
    auth: {
        signInTitle: string;
        signUpTitle: string;
        noAccount: string;
        haveAccount: string;
        createHere: string;
        signInHere: string;
        continueWithGoogle: string;
        registerWithGoogle: string;
        orContinueWith: string;
        emailAddress: string;
        password: string;
        rememberMe: string;
        forgotPassword: string;
        signInButton: string;
        signingIn: string;
        createAccountButton: string;
        creatingAccount: string;
        acceptTerms: string;
        termsService: string;
        privacyPolicy: string;
        byContinuing: string;
        terms: string;
        privacy: string;
        minCharacters: string;
        mustAcceptTerms: string;
        tagline: string;
        testimonial: string;
        testimonialAuthor: string;
        signupTagline: string;
        signupTestimonial: string;
    };

    // Billing
    billing: {
        title: string;
        currentPlan: string;
        tokenBalance: string;
        status: string;
        inactive: string;
        active: string;
        available: string;
        changePlan: string;
        managePayment: string;
        selectPlan: string;
        scheduledChange: string;
        perMonth: string;
        tokenHistory: string;
        date: string;
        reason: string;
        change: string;
        noActivity: string;
        loadingInfo: string;
        paymentProcessed: string;
        buyNow: string;
        oneTimePurchase: string;
        extraTokens: string;
        addToBalance: string;
        noExpire: string;
        approximateScenes: string;
        processing: string;
        currentPlanLabel: string;
        tokensPerMonth: string;
        videoSeconds: string;
        withWatermark: string;
        noWatermark: string;
        prioritySupport: string;
        selectBestPlan: string;
        errorChangingPlan: string;
        errorOpeningPortal: string;
        scenes: string;
        updatingPlan: string;
    };

    // Questionnaire/New Ad
    questionnaire: {
        title: string;
        subtitle: string;
        step1: string;
        step2: string;
        step3: string;
        step4: string;
        basicInfo: string;
        benefits: string;
        videoConfig: string;
        marketing: string;
        productName: string;
        productNamePlaceholder: string;
        targetUsers: string;
        targetUsersPlaceholder: string;
        targetUsersHelp: string;
        productImages: string;
        imagesUploaded: string;
        uploadHelp: string;
        sellingPoints: string;
        sellingPointsPlaceholder: string;
        sellingPointsHelp: string;
        videoType: string;
        mixedType: string;
        avatarType: string;
        productType: string;
        mixedDesc: string;
        avatarDesc: string;
        productDesc: string;
        selectAvatar: string;
        noAvatarSelected: string;
        changeAvatar: string;
        avatarReady: string;
        audioMode: string;
        rawAudio: string;
        rawAudioDesc: string;
        voiceoverAudio: string;
        voiceoverAudioDesc: string;
        targetLanguage: string;
        targetLanguageHelp: string;
        numScenes: string;
        costOfConfig: string;
        costFormula: string;
        moreScenes: string;
        optional: string;
        optionalHelp: string;
        offer: string;
        offerPlaceholder: string;
        offerHelp: string;
        cta: string;
        ctaPlaceholder: string;
        ctaHelp: string;
        tiktokReference: string;
        tiktokPlaceholder: string;
        tiktokHelp: string;
        additionalInstructions: string;
        additionalPlaceholder: string;
        additionalHelp: string;
        totalCost: string;
        yourBalance: string;
        insufficientBalance: string;
        generating: string;
        generateVideo: string;
        required: string;
        recommended: string;
        preparing: string;
    };

    // Landing page extras
    landing: {
        joinBrands: string;
        testimonialQuote: string;
        testimonialAuthor: string;
        testimonialRole: string;
        satisfaction: string;
        satisfactionDesc: string;
        easeOfUse: string;
        easeDesc: string;
        costSavings: string;
        costSavingsDesc: string;
        productHoldingTitle: string;
        productHoldingDesc: string;
        productDemo: string;
        createInfluencer: string;
        createInfluencerDesc: string;
        allRightsReserved: string;
        demo: string;
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
        dashboard: 'Dashboard',
        createAd: 'Create Ad',
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
        tryFreeTrial: 'Try Free',
        choosePlan: 'Choose Plan',
        mostPopular: 'Most Popular',
        credits: 'credits',
        videos: 'videos',
        images: 'images',
        withWatermark: 'With Watermark',
        noWatermark: 'No Watermark',
        prioritySupport: 'Priority Support',
        billedAnnually: 'billed annually',
        processing: 'Processing...',
        subtitle: 'Choose the plan that best fits your needs',
        upgradePlan: 'Upgrade Your Plan',
        save: 'Save',
    },
    common: {
        free: 'Free',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        continue: 'Continue',
        save: 'Save',
        search: 'Search',
        close: 'Close',
        open: 'Open',
        back: 'Back',
        next: 'Next',
        submit: 'Submit',
        tokens: 'tokens',
        scenes: 'scenes',
        english: 'English',
        spanish: 'Spanish',
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
    header: {
        upgradePlan: 'Upgrade Plan',
        billing: 'Billing',
        signOut: 'Sign Out',
    },
    dashboard: {
        title: 'My Ads',
        newAd: 'New Ad',
        searchPlaceholder: 'Search by title, TikTok or ID',
        searchButton: 'Search',
        noAds: 'You have no ads created. Create the first one!',
        draft: 'Draft',
        generated: 'Generated',
        failed: 'Failed',
        processing: 'Processing',
        continueButton: 'Continue',
        openButton: 'Open',
        created: 'Created',
        status: 'Status',
        cost: 'Cost',
        reference: 'Reference',
        actions: 'Actions',
        showing: 'Showing',
        of: 'of',
        page: 'Page',
        previous: 'Previous',
        next: 'Next',
        download: 'Download',
        downloadWatermark: 'Download (Watermark)',
        removeWatermark: 'Remove Watermark',
        untitled: 'Untitled',
    },
    errors: {
        blockedSafety: 'Blocked by safety. Use more neutral text and images.',
        insufficientTokens: 'Insufficient tokens.',
        serviceTimeout: 'Service took too long. Try again.',
        videoGenerationFailed: 'Could not generate video. Try again.',
        reasonDetected: 'Reason Detected',
        authError: 'Authentication error',
        loadBalanceError: 'Error loading balance',
        noBalanceRecord: 'No balance record',
        unexpectedError: 'Unexpected error',
    },
    auth: {
        signInTitle: 'Sign in to your account',
        signUpTitle: 'Create an account',
        noAccount: 'Don\'t have an account?',
        haveAccount: 'Already have an account?',
        createHere: 'Create one here',
        signInHere: 'Sign in here',
        continueWithGoogle: 'Continue with Google',
        registerWithGoogle: 'Sign up with Google',
        orContinueWith: 'OR CONTINUE WITH EMAIL',
        emailAddress: 'Email address',
        password: 'Password',
        rememberMe: 'Remember me',
        forgotPassword: 'Forgot your password?',
        signInButton: 'Sign in',
        signingIn: 'Signing in...',
        createAccountButton: 'Create account',
        creatingAccount: 'Creating account...',
        acceptTerms: 'I accept the',
        termsService: 'Terms of Service',
        privacyPolicy: 'Privacy Policy',
        byContinuing: 'By continuing, you accept our',
        terms: 'Terms',
        privacy: 'Privacy',
        minCharacters: 'Minimum 6 characters',
        mustAcceptTerms: 'You must accept the terms and conditions',
        tagline: 'Create UGC ads with AI in minutes',
        testimonial: '"AnunciosUGC has transformed the way we create content. The speed is incredible"',
        testimonialAuthor: 'Marketing Director',
        signupTagline: 'Join +1,000 brands creating viral content',
        signupTestimonial: '"The best tool to create UGC content. We save weeks of production"',
    },
    billing: {
        title: 'Billing & Plans',
        currentPlan: 'Current Plan',
        tokenBalance: 'Token Balance',
        status: 'Status',
        inactive: 'Inactive',
        active: 'Active',
        available: 'Available to generate',
        changePlan: 'Change plan',
        managePayment: 'Manage payment method / invoices',
        selectPlan: 'Select the plan that best suits you.',
        scheduledChange: 'Scheduled change for next renewal',
        perMonth: '/month',
        tokenHistory: 'Token Activity',
        date: 'Date',
        reason: 'Reason',
        change: 'Change',
        noActivity: 'No token activity yet',
        loadingInfo: 'Loading billing information...',
        paymentProcessed: '✅ Payment processed. Updating your plan...',
        buyNow: 'Buy Now',
        oneTimePurchase: '🪙 One-Time Purchase',
        extraTokens: 'Extra Tokens',
        addToBalance: 'Add to your balance',
        noExpire: 'No expiration',
        approximateScenes: 'scenes',
        processing: 'Processing...',
        currentPlanLabel: 'Current plan',
        tokensPerMonth: 'tokens/month',
        videoSeconds: 'seconds of video',
        withWatermark: 'With Watermark',
        noWatermark: 'No Watermark',
        prioritySupport: 'Priority Support',
        selectBestPlan: 'Select the plan that best suits you.',
        errorChangingPlan: 'Error changing plan. Check logs.',
        errorOpeningPortal: 'Could not open billing portal.',
        scenes: 'scenes',
        updatingPlan: 'Updating your plan...',
    },
    questionnaire: {
        title: 'Create New Ad',
        subtitle: 'Complete the information to generate your promotional video',
        step1: '1',
        step2: '2',
        step3: '3',
        step4: '4',
        basicInfo: 'Basic Information',
        benefits: 'Benefits and Features',
        videoConfig: 'Video Configuration',
        marketing: 'Marketing and Extras',
        productName: 'Product Name',
        productNamePlaceholder: 'E.g: Moisturizing Face Cream',
        targetUsers: 'Target Users',
        targetUsersPlaceholder: 'E.g: Women 25-40 years old looking for natural skin care',
        targetUsersHelp: 'Describe who your ideal customer is',
        productImages: 'Product Images (1-5)',
        imagesUploaded: 'image(s) already uploaded',
        uploadHelp: 'Upload quality photos of your product',
        sellingPoints: 'What makes your product special?',
        sellingPointsPlaceholder: 'Write one benefit per line:\nVisibly reduces wrinkles in 7 days\n100% natural ingredients\n24h deep hydration\nDermatologically tested',
        sellingPointsHelp: 'Write each benefit or feature on a new line',
        videoType: 'Video Type',
        mixedType: 'Mix',
        avatarType: 'Avatar Only',
        productType: 'Product Only',
        mixedDesc: 'Avatar + Product',
        avatarDesc: 'Person speaking',
        productDesc: 'Product images',
        selectAvatar: 'Select Avatar',
        noAvatarSelected: 'You haven\'t selected an avatar',
        changeAvatar: 'Change avatar',
        avatarReady: 'Avatar ready to use',
        audioMode: 'Ad Audio',
        rawAudio: 'Video audio (voices/ambient)',
        rawAudioDesc: 'We use the original audio generated by the video AI (voices, sounds and ambient) and mix it with an AI-generated voiceover for clarity.',
        voiceoverAudio: 'AI voiceover',
        voiceoverAudioDesc: 'We silence the original video audio and add a narration with AI-generated voiceover.',
        targetLanguage: 'Ad Language',
        targetLanguageHelp: 'The script, voiceover (TTS) and audio are generated in the selected language',
        numScenes: 'Number of Scenes',
        costOfConfig: 'Cost of this configuration:',
        costFormula: 'scene × 10 tokens =',
        moreScenes: '💡 More scenes = longer and more complete video',
        optional: '💡 Optional',
        optionalHelp: 'These fields are optional but can improve your ad',
        offer: 'Special Offer',
        offerPlaceholder: 'E.g: 50% discount, Free shipping, 2x1, Limited offer',
        offerHelp: 'Promotion or special discount you want to highlight',
        cta: 'Call to Action',
        ctaPlaceholder: 'E.g: Buy now, Get yours, Visit our website, Discover it',
        ctaHelp: 'Action you want the viewer to take',
        tiktokReference: 'TikTok Reference',
        tiktokPlaceholder: 'https://www.tiktok.com/@user/video/...',
        tiktokHelp: 'URL of a TikTok video that inspires you',
        additionalInstructions: 'Additional Instructions',
        additionalPlaceholder: 'Any special detail or preference you want us to consider...',
        additionalHelp: 'Add any extra indication about the tone, style or content',
        totalCost: 'Total Cost:',
        yourBalance: 'Your Balance:',
        insufficientBalance: '⚠️ Insufficient balance. You need to buy more tokens to continue.',
        generating: '⏳ Generating...',
        generateVideo: '🚀 Generate Video',
        required: '*',
        recommended: 'Recommended',
        preparing: 'Preparing your new ad...',
    },
    landing: {
        joinBrands: 'Join +1,000 brands going viral',
        testimonialQuote: '"AnunciosUGC has transformed the way we create content. We now generate ready-for-social videos in minutes and they look like they cost thousands of dollars."',
        testimonialAuthor: 'Emily Radford',
        testimonialRole: 'Head of Social Content',
        satisfaction: 'Customer satisfaction',
        satisfactionDesc: 'Rated by 1000+ active users',
        easeOfUse: 'Ease of use',
        easeDesc: 'Average creation time: 2.5 min',
        costSavings: 'Cost savings',
        costSavingsDesc: 'Compared to traditional UGC',
        productHoldingTitle: 'Product Holding',
        productHoldingDesc: 'Let AI creators hold and showcase your product like real people.',
        productDemo: 'Product Demo',
        createInfluencer: 'Create your AI Influencer in minutes',
        createInfluencerDesc: 'Create the perfect face for your brand in minutes, with custom uploads or +100 licensed AI actors.',
        allRightsReserved: 'All rights reserved.',
        demo: 'Demo',
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
        dashboard: 'Dashboard',
        createAd: 'Crear Anuncio',
    },
    hero: {
        title: 'Crea vídeos UGC con IA que',
        titleHighlight: 'parecen reales',
        subtitle: 'Genera vídeos estilo influencer donde avatares IA sostienen y hablan de tus productos. Listos para TikTok, Reels y Ads en menos de 3 minutos.',
        ctaPrimary: 'Prueba gratis',
        ctaLogin: 'Iniciar sesión',
    },
    pricing: {
        title: 'Precios',
        monthly: 'Mensual',
        annual: 'Anual',
        annualSave: '-30%',
        perMonth: '/mes',
        tryFreeTrial: 'Prueba Gratis',
        choosePlan: 'Elegir Plan',
        mostPopular: 'Más Popular',
        credits: 'créditos',
        videos: 'vídeos',
        images: 'imágenes',
        withWatermark: 'Con Marca de Agua',
        noWatermark: 'Sin Marca de Agua',
        prioritySupport: 'Soporte Prioritario',
        billedAnnually: 'facturado anualmente',
        processing: 'Procesando...',
        subtitle: 'Elige el plan que mejor se adapte a tus necesidades',
        upgradePlan: 'Mejora tu Plan',
        save: 'Ahorra',
    },
    common: {
        free: 'Gratis',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        cancel: 'Cancelar',
        continue: 'Continuar',
        save: 'Guardar',
        search: 'Buscar',
        close: 'Cerrar',
        open: 'Abrir',
        back: 'Atrás',
        next: 'Siguiente',
        submit: 'Enviar',
        tokens: 'tokens',
        scenes: 'escenas',
        english: 'Inglés',
        spanish: 'Español',
    },
    features: {
        title: 'Crea creativos ganadores con estas funciones',
        avatarSelection: 'Selección de avatar',
        productHolding: 'IA sostiene tu producto',
        talkingHead: 'Vídeo Talking Head',
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
        step3Title: '3. Genera tu vídeo',
        step3Desc: 'Tu vídeo se genera en unos pocos minutos.',
    },
    header: {
        upgradePlan: 'Mejorar Plan',
        billing: 'Facturación',
        signOut: 'Salir',
    },
    dashboard: {
        title: 'Mis Anuncios',
        newAd: 'Nuevo Anuncio',
        searchPlaceholder: 'Buscar por título, TikTok o ID',
        searchButton: 'Buscar',
        noAds: 'No tienes anuncios creados. ¡Crea el primero!',
        draft: 'Borrador',
        generated: 'Generado',
        failed: 'Fallido',
        processing: 'Procesando',
        continueButton: 'Continuar',
        openButton: 'Abrir',
        created: 'Creado',
        status: 'Estado',
        cost: 'Coste',
        reference: 'Referencia',
        actions: 'Acciones',
        showing: 'Mostrando',
        of: 'de',
        page: 'Página',
        previous: 'Anterior',
        next: 'Siguiente',
        download: 'Descargar',
        downloadWatermark: 'Descargar (Marca de agua)',
        removeWatermark: 'Eliminar marca de agua',
        untitled: 'Sin título',
    },
    errors: {
        blockedSafety: 'Bloqueado por seguridad. Usa texto e imágenes más neutros.',
        insufficientTokens: 'No hay tokens suficientes.',
        serviceTimeout: 'El servicio tardó demasiado. Intenta de nuevo.',
        videoGenerationFailed: 'No se pudo generar el vídeo. Intenta de nuevo.',
        reasonDetected: 'Motivo Detectado',
        authError: 'Error de autenticación',
        loadBalanceError: 'Error al cargar saldo',
        noBalanceRecord: 'Sin registro de saldo',
        unexpectedError: 'Error inesperado',
    },
    auth: {
        signInTitle: 'Inicia sesión en tu cuenta',
        signUpTitle: 'Crea una cuenta',
        noAccount: '¿No tienes cuenta?',
        haveAccount: '¿Ya tienes cuenta?',
        createHere: 'Créala aquí',
        signInHere: 'Inicia sesión aquí',
        continueWithGoogle: 'Continuar con Google',
        registerWithGoogle: 'Registrarse con Google',
        orContinueWith: 'O CONTINÚA CON EMAIL',
        emailAddress: 'Dirección de email',
        password: 'Contraseña',
        rememberMe: 'Recuérdame',
        forgotPassword: '¿Olvidaste tu contraseña?',
        signInButton: 'Iniciar sesión',
        signingIn: 'Iniciando sesión...',
        createAccountButton: 'Crear cuenta',
        creatingAccount: 'Creando cuenta...',
        acceptTerms: 'Acepto los',
        termsService: 'Términos de Servicio',
        privacyPolicy: 'Política de Privacidad',
        byContinuing: 'Al continuar, aceptas nuestros',
        terms: 'Términos',
        privacy: 'Privacidad',
        minCharacters: 'Mínimo 6 caracteres',
        mustAcceptTerms: 'Debes aceptar los términos y condiciones',
        tagline: 'Crea anuncios UGC con IA en minutos',
        testimonial: '"AnunciosUGC ha transformado nuestra forma de crear contenido. La velocidad es increíble"',
        testimonialAuthor: 'Directora de Marketing',
        signupTagline: 'Únete a +1.000 marcas creando contenido viral',
        signupTestimonial: '"La mejor herramienta para crear contenido UGC. Ahorramos semanas de producción"',
    },
    billing: {
        title: 'Facturación y Planes',
        currentPlan: 'Plan Actual',
        tokenBalance: 'Saldo de Tokens',
        status: 'Estado',
        inactive: 'Inactivo',
        active: 'Activo',
        available: 'Disponibles para generar',
        changePlan: 'Cambiar plan',
        managePayment: 'Gestionar método de pago / facturas',
        selectPlan: 'Selecciona el plan que mejor se adapte.',
        scheduledChange: 'Cambio programado para la próxima renovación',
        perMonth: '/mes',
        tokenHistory: 'Actividad de Tokens',
        date: 'Fecha',
        reason: 'Razón',
        change: 'Cambio',
        noActivity: 'No hay actividad de tokens todavía',
        loadingInfo: 'Cargando información de facturación...',
        paymentProcessed: '✅ Pago procesado. Actualizando tu plan...',
        buyNow: 'Comprar Ahora',
        oneTimePurchase: '🪙 Compra Puntual',
        extraTokens: 'Tokens Extras',
        addToBalance: 'Se suman a tu saldo',
        noExpire: 'No caducan',
        approximateScenes: 'escenas',
        processing: 'Procesando...',
        currentPlanLabel: 'Plan actual',
        tokensPerMonth: 'tokens/mes',
        videoSeconds: 'segundos de vídeo',
        withWatermark: 'Con Marca de Agua',
        noWatermark: 'Sin Marca de Agua',
        prioritySupport: 'Soporte Prioritario',
        selectBestPlan: 'Selecciona el plan que mejor se adapte.',
        errorChangingPlan: 'Error al cambiar plan. Revisa logs.',
        errorOpeningPortal: 'No se pudo abrir el portal de facturación.',
        scenes: 'escenas',
        updatingPlan: 'Actualizando tu plan...',
    },
    questionnaire: {
        title: 'Crear Nuevo Anuncio',
        subtitle: 'Completa la información para generar tu vídeo publicitario',
        step1: '1',
        step2: '2',
        step3: '3',
        step4: '4',
        basicInfo: 'Información Básica',
        benefits: 'Beneficios y Características',
        videoConfig: 'Configuración del Vídeo',
        marketing: 'Marketing y Extras',
        productName: 'Nombre del Producto',
        productNamePlaceholder: 'Ej: Crema Facial Hidratante',
        targetUsers: 'Usuario Objetivo',
        targetUsersPlaceholder: 'Ej: Mujeres de 25-40 años que buscan cuidado de piel natural',
        targetUsersHelp: 'Describe quién es tu cliente ideal',
        productImages: 'Imágenes del Producto (1-5)',
        imagesUploaded: 'imagen(es) ya subida(s)',
        uploadHelp: 'Sube fotos de calidad de tu producto',
        sellingPoints: '¿Qué hace especial a tu producto?',
        sellingPointsPlaceholder: 'Escribe un beneficio por línea:\nReduce arrugas visiblemente en 7 días\nIngredientes 100% naturales\nHidratación profunda 24h\nTestado dermatológicamente',
        sellingPointsHelp: 'Escribe cada beneficio o característica en una línea nueva',
        videoType: 'Tipo de Vídeo',
        mixedType: 'Mix',
        avatarType: 'Solo Avatar',
        productType: 'Solo Producto',
        mixedDesc: 'Avatar + Producto',
        avatarDesc: 'Persona hablando',
        productDesc: 'Imágenes del producto',
        selectAvatar: 'Seleccionar Avatar',
        noAvatarSelected: 'No has seleccionado un avatar',
        changeAvatar: 'Cambiar avatar',
        avatarReady: 'Avatar listo para usar',
        audioMode: 'Audio del Anuncio',
        rawAudio: 'Audio del vídeo (voces/ambiente)',
        rawAudioDesc: 'Usamos el audio original que genera la IA de vídeo (voces, sonidos y ambiente) y lo mezclamos con una voz en off generada con IA para mayor claridad.',
        voiceoverAudio: 'Voz en off con IA',
        voiceoverAudioDesc: 'Silenciamos el audio original del vídeo y añadimos una narración con voz en off generada con IA.',
        targetLanguage: 'Idioma del Anuncio',
        targetLanguageHelp: 'El guion, la voz en off (TTS) y el audio se generan en el idioma seleccionado',
        numScenes: 'Número de Escenas',
        costOfConfig: 'Coste de esta configuración:',
        costFormula: 'escena × 10 tokens =',
        moreScenes: '💡 Más escenas = vídeo más largo y completo',
        optional: '💡 Opcional',
        optionalHelp: 'Estos campos son opcionales pero pueden mejorar tu anuncio',
        offer: 'Oferta Especial',
        offerPlaceholder: 'Ej: 50% descuento, Envío gratis, 2x1, Oferta limitada',
        offerHelp: 'Promoción o descuento especial que quieras destacar',
        cta: 'Llamada a la Acción',
        ctaPlaceholder: 'Ej: Compra ahora, Consigue el tuyo, Visita nuestra web, Descúbrelo',
        ctaHelp: 'Acción que quieres que tome el espectador',
        tiktokReference: 'Referencia TikTok',
        tiktokPlaceholder: 'https://www.tiktok.com/@user/video/...',
        tiktokHelp: 'URL de un vídeo de TikTok que te inspire',
        additionalInstructions: 'Instrucciones Adicionales',
        additionalPlaceholder: 'Cualquier detalle especial o preferencia que quieras que tengamos en cuenta...',
        additionalHelp: 'Agrega cualquier indicación extra sobre el tono, estilo o contenido',
        totalCost: 'Coste Total:',
        yourBalance: 'Tu Saldo:',
        insufficientBalance: '⚠️ Saldo insuficiente. Necesitas comprar más tokens para continuar.',
        generating: '⏳ Generando...',
        generateVideo: '🚀 Generar Vídeo',
        required: '*',
        recommended: 'Recomendado',
        preparing: 'Preparando tu nuevo anuncio...',
    },
    landing: {
        joinBrands: 'Únete a +1.000 marcas que se hacen virales',
        testimonialQuote: '"AnunciosUGC ha cambiado nuestra forma de crear contenido. Ahora generamos vídeos listos para redes en minutos y parecen costar miles de dólares."',
        testimonialAuthor: 'Emily Radford',
        testimonialRole: 'Directora de Contenido Social',
        satisfaction: 'Satisfacción del cliente',
        satisfactionDesc: 'Valorado por 1000+ usuarios activos',
        easeOfUse: 'Facilidad de uso',
        easeDesc: 'Tiempo medio de creación: 2,5 min',
        costSavings: 'Ahorro de costes',
        costSavingsDesc: 'Comparado con UGC tradicional',
        productHoldingTitle: 'Sujeción de producto',
        productHoldingDesc: 'Deja que los creadores IA sostengan y destaquen tu producto como personas reales.',
        productDemo: 'Producto Demo',
        createInfluencer: 'Crea tu Influencer IA en minutos',
        createInfluencerDesc: 'Crea la cara perfecta para tu marca en minutos, con subidas personalizadas o +100 actores IA licenciados.',
        allRightsReserved: 'Todos los derechos reservados.',
        demo: 'Demo',
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
        dashboard: 'Dashboard',
        createAd: 'Crear Anuncio',
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
        tryFreeTrial: 'Prueba Gratis',
        choosePlan: 'Elegir Plan',
        mostPopular: 'Más Popular',
        credits: 'créditos',
        videos: 'videos',
        images: 'imágenes',
        withWatermark: 'Con Marca de Agua',
        noWatermark: 'Sin Marca de Agua',
        prioritySupport: 'Soporte Prioritario',
        billedAnnually: 'facturado anualmente',
        processing: 'Procesando...',
        subtitle: 'Elige el plan que mejor se adapte a tus necesidades',
        upgradePlan: 'Mejora tu Plan',
        save: 'Ahorra',
    },
    common: {
        free: 'Gratis',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        cancel: 'Cancelar',
        continue: 'Continuar',
        save: 'Guardar',
        search: 'Buscar',
        close: 'Cerrar',
        open: 'Abrir',
        back: 'Atrás',
        next: 'Siguiente',
        submit: 'Enviar',
        tokens: 'tokens',
        scenes: 'escenas',
        english: 'Inglés',
        spanish: 'Español',
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
    header: {
        upgradePlan: 'Mejorar Plan',
        billing: 'Facturación',
        signOut: 'Salir',
    },
    dashboard: {
        title: 'Mis Anuncios',
        newAd: 'Nuevo Anuncio',
        searchPlaceholder: 'Buscar por título, TikTok o ID',
        searchButton: 'Buscar',
        noAds: 'No tienes anuncios creados. ¡Crea el primero!',
        draft: 'Borrador',
        generated: 'Generado',
        failed: 'Fallido',
        processing: 'Procesando',
        continueButton: 'Continuar',
        openButton: 'Abrir',
        created: 'Creado',
        status: 'Estado',
        cost: 'Costo',
        reference: 'Referencia',
        actions: 'Acciones',
        showing: 'Mostrando',
        of: 'de',
        page: 'Página',
        previous: 'Anterior',
        next: 'Siguiente',
        download: 'Descargar',
        downloadWatermark: 'Descargar (Marca de agua)',
        removeWatermark: 'Eliminar marca de agua',
        untitled: 'Sin título',
    },
    errors: {
        blockedSafety: 'Bloqueado por seguridad. Usa texto e imágenes más neutrales.',
        insufficientTokens: 'No hay tokens suficientes.',
        serviceTimeout: 'El servicio tardó demasiado. Intenta de nuevo.',
        videoGenerationFailed: 'No se pudo generar el video. Intenta de nuevo.',
        reasonDetected: 'Motivo Detectado',
        authError: 'Error de autenticación',
        loadBalanceError: 'Error al cargar saldo',
        noBalanceRecord: 'Sin registro de saldo',
        unexpectedError: 'Error inesperado',
    },
    auth: {
        signInTitle: 'Inicia sesión en tu cuenta',
        signUpTitle: 'Crea una cuenta',
        noAccount: '¿No tienes cuenta?',
        haveAccount: '¿Ya tienes cuenta?',
        createHere: 'Créala aquí',
        signInHere: 'Inicia sesión aquí',
        continueWithGoogle: 'Continuar con Google',
        registerWithGoogle: 'Registrarse con Google',
        orContinueWith: 'O CONTINÚA CON EMAIL',
        emailAddress: 'Dirección de email',
        password: 'Contraseña',
        rememberMe: 'Recuérdame',
        forgotPassword: '¿Olvidaste tu contraseña?',
        signInButton: 'Iniciar sesión',
        signingIn: 'Iniciando sesión...',
        createAccountButton: 'Crear cuenta',
        creatingAccount: 'Creando cuenta...',
        acceptTerms: 'Acepto los',
        termsService: 'Términos de Servicio',
        privacyPolicy: 'Política de Privacidad',
        byContinuing: 'Al continuar, aceptas nuestros',
        terms: 'Términos',
        privacy: 'Privacidad',
        minCharacters: 'Mínimo 6 caracteres',
        mustAcceptTerms: 'Debes aceptar los términos y condiciones',
        tagline: 'Crea anuncios UGC con IA en minutos',
        testimonial: '"AnunciosUGC ha transformado nuestra forma de crear contenido. La velocidad es increíble"',
        testimonialAuthor: 'Directora de Marketing',
        signupTagline: 'Únete a +1,000 marcas creando contenido viral',
        signupTestimonial: '"La mejor herramienta para crear contenido UGC. Ahorramos semanas de producción"',
    },
    billing: {
        title: 'Facturación y Planes',
        currentPlan: 'Plan Actual',
        tokenBalance: 'Saldo de Tokens',
        status: 'Estado',
        inactive: 'Inactivo',
        active: 'Activo',
        available: 'Disponibles para generar',
        changePlan: 'Cambiar plan',
        managePayment: 'Gestionar método de pago / facturas',
        selectPlan: 'Selecciona el plan que mejor se adapte.',
        scheduledChange: 'Cambio programado para la próxima renovación',
        perMonth: '/mes',
        tokenHistory: 'Actividad de Tokens',
        date: 'Fecha',
        reason: 'Razón',
        change: 'Cambio',
        noActivity: 'No hay actividad de tokens todavía',
        loadingInfo: 'Cargando información de facturación...',
        paymentProcessed: '✅ Pago procesado. Actualizando tu plan...',
        buyNow: 'Comprar Ahora',
        oneTimePurchase: '🪙 Compra Puntual',
        extraTokens: 'Tokens Extras',
        addToBalance: 'Se suman a tu saldo',
        noExpire: 'No caducan',
        approximateScenes: 'escenas',
        processing: 'Procesando...',
        currentPlanLabel: 'Plan actual',
        tokensPerMonth: 'tokens/mes',
        videoSeconds: 'segundos de video',
        withWatermark: 'Con Marca de Agua',
        noWatermark: 'Sin Marca de Agua',
        prioritySupport: 'Soporte Prioritario',
        selectBestPlan: 'Selecciona el plan que mejor se adapte.',
        errorChangingPlan: 'Error al cambiar plan. Revisa logs.',
        errorOpeningPortal: 'No se pudo abrir el portal de facturación.',
        scenes: 'escenas',
        updatingPlan: 'Actualizando tu plan...',
    },
    questionnaire: {
        title: 'Crear Nuevo Anuncio',
        subtitle: 'Completa la información para generar tu video publicitario',
        step1: '1',
        step2: '2',
        step3: '3',
        step4: '4',
        basicInfo: 'Información Básica',
        benefits: 'Beneficios y Características',
        videoConfig: 'Configuración del Video',
        marketing: 'Marketing y Extras',
        productName: 'Nombre del Producto',
        productNamePlaceholder: 'Ej: Crema Facial Hidratante',
        targetUsers: 'Usuario Objetivo',
        targetUsersPlaceholder: 'Ej: Mujeres de 25-40 años que buscan cuidado de piel natural',
        targetUsersHelp: 'Describe quién es tu cliente ideal',
        productImages: 'Imágenes del Producto (1-5)',
        imagesUploaded: 'imagen(es) ya subida(s)',
        uploadHelp: 'Sube fotos de calidad de tu producto',
        sellingPoints: '¿Qué hace especial a tu producto?',
        sellingPointsPlaceholder: 'Escribe un beneficio por línea:\nReduce arrugas visiblemente en 7 días\nIngredientes 100% naturales\nHidratación profunda 24h\nTestado dermatológicamente',
        sellingPointsHelp: 'Escribe cada beneficio o característica en una línea nueva',
        videoType: 'Tipo de Video',
        mixedType: 'Mix',
        avatarType: 'Solo Avatar',
        productType: 'Solo Producto',
        mixedDesc: 'Avatar + Producto',
        avatarDesc: 'Persona hablando',
        productDesc: 'Imágenes del producto',
        selectAvatar: 'Seleccionar Avatar',
        noAvatarSelected: 'No has seleccionado un avatar',
        changeAvatar: 'Cambiar avatar',
        avatarReady: 'Avatar listo para usar',
        audioMode: 'Audio del Anuncio',
        rawAudio: 'Audio del video (voces/ambiente)',
        rawAudioDesc: 'Usamos el audio original que genera la IA de video (voces, sonidos y ambiente) y lo mezclamos con una voz en off generada con IA para mayor claridad.',
        voiceoverAudio: 'Voz en off con IA',
        voiceoverAudioDesc: 'Silenciamos el audio original del video y añadimos una narración con voz en off generada con IA.',
        targetLanguage: 'Idioma del Anuncio',
        targetLanguageHelp: 'El guion, la voz en off (TTS) y el audio se generan en el idioma seleccionado',
        numScenes: 'Número de Escenas',
        costOfConfig: 'Costo de esta configuración:',
        costFormula: 'escena × 10 tokens =',
        moreScenes: '💡 Más escenas = video más largo y completo',
        optional: '💡 Opcional',
        optionalHelp: 'Estos campos son opcionales pero pueden mejorar tu anuncio',
        offer: 'Oferta Especial',
        offerPlaceholder: 'Ej: 50% descuento, Envío gratis, 2x1, Oferta limitada',
        offerHelp: 'Promoción o descuento especial que quieras destacar',
        cta: 'Llamada a la Acción',
        ctaPlaceholder: 'Ej: Compra ahora, Consigue el tuyo, Visita nuestra web, Descúbrelo',
        ctaHelp: 'Acción que quieres que tome el espectador',
        tiktokReference: 'Referencia TikTok',
        tiktokPlaceholder: 'https://www.tiktok.com/@user/video/...',
        tiktokHelp: 'URL de un video de TikTok que te inspire',
        additionalInstructions: 'Instrucciones Adicionales',
        additionalPlaceholder: 'Cualquier detalle especial o preferencia que quieras que tengamos en cuenta...',
        additionalHelp: 'Agrega cualquier indicación extra sobre el tono, estilo o contenido',
        totalCost: 'Costo Total:',
        yourBalance: 'Tu Saldo:',
        insufficientBalance: '⚠️ Saldo insuficiente. Necesitas comprar más tokens para continuar.',
        generating: '⏳ Generando...',
        generateVideo: '🚀 Generar Video',
        required: '*',
        recommended: 'Recomendado',
        preparing: 'Preparando tu nuevo anuncio...',
    },
    landing: {
        joinBrands: 'Únete a +1,000 marcas que se hacen virales',
        testimonialQuote: '"AnunciosUGC ha cambiado nuestra forma de crear contenido. Ahora generamos videos listos para redes en minutos y parecen costar miles de dólares."',
        testimonialAuthor: 'Emily Radford',
        testimonialRole: 'Directora de Contenido Social',
        satisfaction: 'Satisfacción del cliente',
        satisfactionDesc: 'Valorado por 1000+ usuarios activos',
        easeOfUse: 'Facilidad de uso',
        easeDesc: 'Tiempo medio de creación: 2.5 min',
        costSavings: 'Ahorro de costos',
        costSavingsDesc: 'Comparado con UGC tradicional',
        productHoldingTitle: 'Sujeción de producto',
        productHoldingDesc: 'Deja que los creadores IA sostengan y destaquen tu producto como personas reales.',
        productDemo: 'Producto Demo',
        createInfluencer: 'Crea tu Influencer IA en minutos',
        createInfluencerDesc: 'Crea la cara perfecta para tu marca en minutos, con subidas personalizadas o +100 actores IA licenciados.',
        allRightsReserved: 'Todos los derechos reservados.',
        demo: 'Demo',
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

