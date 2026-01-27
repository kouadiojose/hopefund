/**
 * HOPEFUND DIGITAL BANKING
 * Main JavaScript File
 * Handles all interactive functionality
 */

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Debounce function for performance optimization
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Format number with thousands separator
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ====================================
// DOM ELEMENTS
// ====================================

const header = document.getElementById('header');
const navToggle = document.getElementById('nav-toggle');
const navClose = document.getElementById('nav-close');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav__link');
const preloader = document.getElementById('preloader');
const backToTop = document.getElementById('backToTop');
const loginBtn = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const pricingToggle = document.getElementById('pricingToggle');
const faqItems = document.querySelectorAll('.faq__item');
const testimonialsTrack = document.getElementById('testimonials__track');
const prevTestimonialBtn = document.getElementById('prevTestimonial');
const nextTestimonialBtn = document.getElementById('nextTestimonial');
const testimonialsDots = document.getElementById('testimonialsDots');

// ====================================
// PRELOADER
// ====================================

window.addEventListener('load', () => {
    setTimeout(() => {
        preloader.classList.add('loaded');
        document.body.classList.remove('no-scroll');

        // Initialize AOS animations after preloader
        AOS.init({
            duration: 800,
            easing: 'ease-out',
            once: true,
            offset: 100
        });

        // Start counter animation
        animateCounters();
    }, 1000);
});

// ====================================
// HEADER SCROLL EFFECT
// ====================================

const handleScroll = debounce(() => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }

    // Back to top button
    if (window.scrollY > 500) {
        backToTop.classList.add('show');
    } else {
        backToTop.classList.remove('show');
    }

    // Update active nav link based on scroll position
    updateActiveNavLink();
}, 10);

window.addEventListener('scroll', handleScroll);

// ====================================
// MOBILE NAVIGATION
// ====================================

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.add('show');
        document.body.classList.add('no-scroll');
    });
}

if (navClose) {
    navClose.addEventListener('click', () => {
        navMenu.classList.remove('show');
        document.body.classList.remove('no-scroll');
    });
}

// Close menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('show');
        document.body.classList.remove('no-scroll');
    });
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (navMenu.classList.contains('show') &&
        !navMenu.contains(e.target) &&
        !navToggle.contains(e.target)) {
        navMenu.classList.remove('show');
        document.body.classList.remove('no-scroll');
    }
});

// ====================================
// ACTIVE NAV LINK ON SCROLL
// ====================================

function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 150;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav__link[href="#${sectionId}"]`);

        if (navLink) {
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLink.classList.add('active');
            } else {
                navLink.classList.remove('active');
            }
        }
    });
}

// ====================================
// SMOOTH SCROLL
// ====================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ====================================
// BACK TO TOP
// ====================================

if (backToTop) {
    backToTop.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ====================================
// COUNTER ANIMATION
// ====================================

function animateCounters() {
    const counters = document.querySelectorAll('.hero__stat-number');

    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += step;
            if (current < target) {
                counter.textContent = formatNumber(Math.floor(current));
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = formatNumber(target);
            }
        };

        // Start animation when element is in view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateCounter();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(counter);
    });
}

// ====================================
// LOGIN MODAL
// ====================================

if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.add('show');
        document.body.classList.add('no-scroll');
    });
}

if (closeLoginModal) {
    closeLoginModal.addEventListener('click', () => {
        loginModal.classList.remove('show');
        document.body.classList.remove('no-scroll');
    });
}

// Close modal on overlay click
if (loginModal) {
    loginModal.querySelector('.modal__overlay').addEventListener('click', () => {
        loginModal.classList.remove('show');
        document.body.classList.remove('no-scroll');
    });
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && loginModal.classList.contains('show')) {
        loginModal.classList.remove('show');
        document.body.classList.remove('no-scroll');
    }
});

// Password toggle
document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
        const input = this.previousElementSibling;
        const icon = this.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
});

// ====================================
// PRICING TOGGLE
// ====================================

if (pricingToggle) {
    pricingToggle.addEventListener('change', function() {
        const amounts = document.querySelectorAll('.pricing__amount');
        const isYearly = this.checked;

        amounts.forEach(amount => {
            const monthly = amount.getAttribute('data-monthly');
            const yearly = amount.getAttribute('data-yearly');
            const value = isYearly ? yearly : monthly;
            amount.textContent = formatNumber(parseInt(value));
        });
    });
}

// ====================================
// FAQ ACCORDION
// ====================================

faqItems.forEach(item => {
    const question = item.querySelector('.faq__question');

    question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Close all items
        faqItems.forEach(faq => {
            faq.classList.remove('active');
        });

        // Open clicked item if it wasn't active
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// ====================================
// TESTIMONIALS SLIDER
// ====================================

class TestimonialsSlider {
    constructor() {
        this.track = document.getElementById('testimonialsTrack');
        this.prevBtn = document.getElementById('prevTestimonial');
        this.nextBtn = document.getElementById('nextTestimonial');
        this.dotsContainer = document.getElementById('testimonialsDots');

        if (!this.track) return;

        this.cards = this.track.querySelectorAll('.testimonial__card');
        this.currentIndex = 0;
        this.totalSlides = this.cards.length;
        this.autoPlayInterval = null;

        this.init();
    }

    init() {
        this.createDots();
        this.updateSlider();
        this.bindEvents();
        this.startAutoPlay();
    }

    createDots() {
        for (let i = 0; i < this.totalSlides; i++) {
            const dot = document.createElement('span');
            dot.classList.add('dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => this.goToSlide(i));
            this.dotsContainer.appendChild(dot);
        }
    }

    updateSlider() {
        const offset = -this.currentIndex * 100;
        this.track.style.transform = `translateX(${offset}%)`;

        // Update dots
        const dots = this.dotsContainer.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentIndex);
        });
    }

    goToSlide(index) {
        this.currentIndex = index;
        this.updateSlider();
    }

    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.totalSlides;
        this.updateSlider();
    }

    prevSlide() {
        this.currentIndex = (this.currentIndex - 1 + this.totalSlides) % this.totalSlides;
        this.updateSlider();
    }

    startAutoPlay() {
        this.autoPlayInterval = setInterval(() => this.nextSlide(), 5000);
    }

    stopAutoPlay() {
        clearInterval(this.autoPlayInterval);
    }

    bindEvents() {
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => {
                this.stopAutoPlay();
                this.prevSlide();
                this.startAutoPlay();
            });
        }

        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => {
                this.stopAutoPlay();
                this.nextSlide();
                this.startAutoPlay();
            });
        }

        // Touch events for mobile
        let touchStartX = 0;
        let touchEndX = 0;

        this.track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        this.track.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });

        const handleSwipe = () => {
            if (touchEndX < touchStartX - 50) {
                this.stopAutoPlay();
                this.nextSlide();
                this.startAutoPlay();
            }
            if (touchEndX > touchStartX + 50) {
                this.stopAutoPlay();
                this.prevSlide();
                this.startAutoPlay();
            }
        };

        this.handleSwipe = handleSwipe;
    }
}

// Initialize testimonials slider
new TestimonialsSlider();

// ====================================
// FORM HANDLING
// ====================================

// Contact Form
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Get form data
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);

        // Simulate form submission
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Message envoyé!';
            submitBtn.style.background = 'var(--success-color)';

            // Reset form
            this.reset();

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
            }, 2000);
        }, 1500);
    });
}

// CTA Registration Form
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = this.querySelector('input[type="email"]').value;
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Inscription réussie!';

            // Clear input
            this.querySelector('input[type="email"]').value = '';

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 2000);
        }, 1500);
    });
}

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Connecté!';

            setTimeout(() => {
                // Close modal
                loginModal.classList.remove('show');
                document.body.classList.remove('no-scroll');

                // Reset button and form
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                this.reset();

                // Show success notification
                showNotification('Connexion réussie! Redirection en cours...', 'success');
            }, 1000);
        }, 1500);
    });
}

// ====================================
// NOTIFICATION SYSTEM
// ====================================

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification__close"><i class="fas fa-times"></i></button>
    `;

    // Add styles dynamically
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        z-index: 3000;
        animation: slideIn 0.3s ease-out;
    `;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Close button handler
    notification.querySelector('.notification__close').addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => notification.remove(), 300);
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ====================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ====================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animated');
        }
    });
}, observerOptions);

// Observe all animatable elements
document.querySelectorAll('.service__card, .feature__item, .step, .pricing__card').forEach(el => {
    animationObserver.observe(el);
});

// ====================================
// PARALLAX EFFECT FOR HERO SHAPES
// ====================================

const heroShapes = document.querySelectorAll('.hero__shape');

window.addEventListener('mousemove', (e) => {
    const { clientX, clientY } = e;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    heroShapes.forEach((shape, index) => {
        const speed = (index + 1) * 0.02;
        const x = (clientX - centerX) * speed;
        const y = (clientY - centerY) * speed;

        shape.style.transform = `translate(${x}px, ${y}px)`;
    });
});

// ====================================
// FLOATING CARDS ANIMATION
// ====================================

const floatingCards = document.querySelectorAll('.hero__floating-card');

floatingCards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.5}s`;
});

// ====================================
// PHONE MOCKUP INTERACTION
// ====================================

const phoneActions = document.querySelectorAll('.phone__action');

phoneActions.forEach(action => {
    action.addEventListener('click', function() {
        // Add click effect
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 100);
    });
});

// ====================================
// INITIALIZATION
// ====================================

document.addEventListener('DOMContentLoaded', () => {
    // Add body class for loaded state
    document.body.classList.add('no-scroll');

    // Remove body scroll lock after preloader
    setTimeout(() => {
        document.body.classList.remove('no-scroll');
    }, 1500);
});

// ====================================
// CONSOLE BRANDING
// ====================================

console.log(
    '%c🏦 Hopefund Digital Banking',
    'font-size: 24px; font-weight: bold; color: #0066FF;'
);
console.log(
    '%cBuilt with ❤️ for the future of banking',
    'font-size: 14px; color: #6B7280;'
);
