export const SENSITIVE_KEYWORDS_FOR_VIDEO = [
    'underwear',
    'boxers',
    'lingerie',
    'bra',
    'bras',
    'panty',
    'panties',
    'thong',
    'bikini',
    'swimwear',
    'swimsuit',
    'naked',
    'nude',
    'sexual',
    'sexy',
    'erotic',
    'xxx',
    'porn'
]

/**
 * Checks if the text contains sensitive keywords that might trigger Veo safety filters.
 * Returns true if sensitive content is detected.
 */
export function isSensitiveForVideo(text: string): boolean {
    if (!text) return false

    const lowerText = text.toLowerCase()

    // Check for exact word matches or simple inclusion
    // We use simple inclusion for safety, but could be more sophisticated with regex if needed
    return SENSITIVE_KEYWORDS_FOR_VIDEO.some(keyword => {
        // Check for keyword as a whole word or part of a word?
        // For now, let's just check inclusion but be careful about false positives (e.g. "brand" contains "bra")
        // So we'll use regex for word boundaries
        const regex = new RegExp(`\\b${keyword}\\b`, 'i')
        return regex.test(lowerText)
    })
}
