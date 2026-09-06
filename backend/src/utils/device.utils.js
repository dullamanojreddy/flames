/**
 * device.utils.js
 * Lightweight, zero-dependency User-Agent analyzer.
 * Extracts device classification, operating system, and browser safely.
 */

/**
 * Parse a raw User-Agent header into structured device metadata.
 *
 * @param {string} [uaString] Raw User-Agent string from request headers.
 * @returns {{
 *   browser: string,
 *   os: string,
 *   device: "Mobile" | "Tablet" | "Desktop" | "Bot" | "Unknown"
 * }}
 */
function parseUserAgent(uaString) {
    const ua = String(uaString || "").trim();

    if (!ua) {
        return {
            browser: "Unknown",
            os: "Unknown",
            device: "Unknown"
        };
    }

    // 1. Bot / Crawler Detection
    if (/bot|crawler|spider|crawling|curl|wget|postman|insomnia|headless/i.test(ua)) {
        return {
            browser: "Bot / Crawler",
            os: "Server / Bot",
            device: "Bot"
        };
    }

    // 2. Device Type Classification
    let device = "Desktop";
    const isTablet = /tablet|ipad|playbook|silk|(android(?!.*mobi))/i.test(ua);
    const isMobile = /mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|android.*mobile/i.test(ua);

    if (isTablet) {
        device = "Tablet";
    } else if (isMobile) {
        device = "Mobile";
    }

    // 3. Operating System Detection
    let os = "Other";
    if (/windows phone/i.test(ua)) {
        os = "Windows Phone";
    } else if (/windows nt 10\.0/i.test(ua)) {
        os = "Windows 10/11";
    } else if (/windows nt 6\.3/i.test(ua)) {
        os = "Windows 8.1";
    } else if (/windows nt 6\.2/i.test(ua)) {
        os = "Windows 8";
    } else if (/windows nt 6\.1/i.test(ua)) {
        os = "Windows 7";
    } else if (/windows/i.test(ua)) {
        os = "Windows";
    } else if (/iphone|ipad|ipod/i.test(ua)) {
        os = "iOS";
    } else if (/android/i.test(ua)) {
        os = "Android";
    } else if (/macintosh|mac os x/i.test(ua)) {
        os = "macOS";
    } else if (/cros/i.test(ua)) {
        os = "Chrome OS";
    } else if (/linux/i.test(ua)) {
        os = "Linux";
    }

    // 4. Browser Detection (Order matters!)
    let browser = "Other";
    if (/edg\//i.test(ua)) {
        browser = "Microsoft Edge";
    } else if (/opr\/|opera/i.test(ua)) {
        browser = "Opera";
    } else if (/samsungbrowser/i.test(ua)) {
        browser = "Samsung Internet";
    } else if (/ucbrowser/i.test(ua)) {
        browser = "UC Browser";
    } else if (/chrome|crios/i.test(ua)) {
        browser = "Google Chrome";
    } else if (/firefox|fxios/i.test(ua)) {
        browser = "Mozilla Firefox";
    } else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) {
        browser = "Apple Safari";
    }

    return {
        browser,
        os,
        device
    };
}

module.exports = {
    parseUserAgent
};
