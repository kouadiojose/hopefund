/**
 * Hopefund Burundi - Internationalization (i18n) System
 * Supports: French (fr), English (en), Kirundi (rn)
 */

class I18n {
    constructor() {
        this.translations = {};
        this.currentLang = localStorage.getItem('hopefund_lang') || 'fr';
        this.defaultLang = 'fr';
        this.supportedLangs = ['fr', 'en', 'rn'];
        this.isLoaded = false;
    }

    async init() {
        // Load all translations
        await this.loadTranslations();

        // Apply current language
        this.applyLanguage(this.currentLang);

        // Setup language switcher events
        this.setupLanguageSwitcher();

        this.isLoaded = true;

        // Dispatch event when ready
        window.dispatchEvent(new CustomEvent('i18nReady', { detail: { lang: this.currentLang } }));
    }

    async loadTranslations() {
        const loadPromises = this.supportedLangs.map(async (lang) => {
            try {
                const response = await fetch(`translations/${lang}.json`);
                if (response.ok) {
                    this.translations[lang] = await response.json();
                }
            } catch (error) {
                console.warn(`Could not load translations for ${lang}:`, error);
            }
        });

        await Promise.all(loadPromises);
    }

    get(key, lang = this.currentLang) {
        const keys = key.split('.');
        let value = this.translations[lang];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Fallback to default language
                if (lang !== this.defaultLang) {
                    return this.get(key, this.defaultLang);
                }
                return key; // Return key if not found
            }
        }

        return value;
    }

    setLanguage(lang) {
        if (!this.supportedLangs.includes(lang)) {
            console.warn(`Language ${lang} is not supported`);
            return;
        }

        this.currentLang = lang;
        localStorage.setItem('hopefund_lang', lang);

        this.applyLanguage(lang);

        // Dispatch language change event
        window.dispatchEvent(new CustomEvent('languageChange', { detail: { lang } }));
    }

    applyLanguage(lang) {
        // Update HTML lang attribute
        document.documentElement.lang = lang;

        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const value = this.get(key, lang);

            if (value) {
                // Check if it's an input placeholder
                if (el.hasAttribute('placeholder') && el.getAttribute('data-i18n-attr') === 'placeholder') {
                    el.placeholder = value;
                } else if (el.getAttribute('data-i18n-attr') === 'content') {
                    el.setAttribute('content', value);
                } else {
                    el.innerHTML = value;
                }
            }
        });

        // Update elements with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.get(key, lang);
        });

        // Update active language in switcher
        this.updateLanguageSwitcher(lang);
    }

    setupLanguageSwitcher() {
        // Handle language button clicks
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = btn.getAttribute('data-lang');
                this.setLanguage(lang);
            });
        });

        // Handle dropdown toggle
        const langToggle = document.querySelector('.lang-toggle');
        const langDropdown = document.querySelector('.lang-dropdown');

        if (langToggle && langDropdown) {
            langToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                langDropdown.classList.toggle('active');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                langDropdown.classList.remove('active');
            });
        }
    }

    updateLanguageSwitcher(lang) {
        // Update active states
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });

        // Update current language display
        const currentLangEl = document.querySelector('.lang-current');
        if (currentLangEl) {
            const langData = this.translations[lang]?.meta;
            if (langData) {
                currentLangEl.innerHTML = `${langData.flag} ${langData.name}`;
            }
        }
    }

    // Helper to get all translations for admin panel
    getAllTranslations() {
        return this.translations;
    }

    // Helper to update a translation (for admin panel)
    updateTranslation(lang, key, value) {
        const keys = key.split('.');
        let obj = this.translations[lang];

        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in obj)) {
                obj[keys[i]] = {};
            }
            obj = obj[keys[i]];
        }

        obj[keys[keys.length - 1]] = value;
    }

    // Export translations as JSON (for admin panel)
    exportTranslations(lang) {
        return JSON.stringify(this.translations[lang], null, 2);
    }
}

// Create global instance
window.i18n = new I18n();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.i18n.init();
});
