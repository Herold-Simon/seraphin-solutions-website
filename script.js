// Mobile Navigation Toggle
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');

if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
        nav.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    // Close menu when clicking on a link
    const navLinks = nav.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && !hamburger.contains(e.target)) {
            nav.classList.remove('active');
            hamburger.classList.remove('active');
        }
    });
}

// Mobile Navigation Toggle (navbar variant: .navbar + .nav-menu)
const navbarHamburger = document.querySelector('.navbar .hamburger');
const navbarMenu = document.querySelector('.navbar .nav-menu');

if (navbarHamburger && navbarMenu) {
    navbarHamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        navbarMenu.classList.toggle('active');
    });

    // Close menu when clicking a link
    navbarMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navbarMenu.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navbarMenu.contains(e.target) && !navbarHamburger.contains(e.target)) {
            navbarMenu.classList.remove('active');
        }
    });
}

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// References Carousel
const carousel = document.getElementById('carousel');
const carouselPrev = document.getElementById('carouselPrev');
const carouselNext = document.getElementById('carouselNext');
let currentSlide = 0;

if (carousel && carouselPrev && carouselNext) {
    const track = document.getElementById('carouselTrack');
    const slides = carousel.querySelectorAll('.carousel-slide');
    const totalSlides = slides.length;

    // Only show arrows if there are multiple slides
    if (totalSlides > 1) {
        carouselPrev.style.display = 'flex';
        carouselNext.style.display = 'flex';
    }

    function showSlide(index) {
        currentSlide = index;
        if (track) {
            track.style.transform = `translateX(-${index * 100}%)`;
        }
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % totalSlides;
        showSlide(currentSlide);
    }

    function prevSlide() {
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        showSlide(currentSlide);
    }

    if (totalSlides > 1) {
        carouselNext.addEventListener('click', nextSlide);
        carouselPrev.addEventListener('click', prevSlide);
    }
    showSlide(0);
}

// Price Calculator with Sliders
const flaecheSlider = document.getElementById('flaeche');
const kioskeSlider = document.getElementById('kioske');
const flaecheValue = document.getElementById('flaecheValue');
const kioskeValue = document.getElementById('kioskeValue');
const calculatorResult = document.getElementById('calculatorResult');
const resultPrice = document.getElementById('resultPrice');
const resultBreakdown = document.getElementById('resultBreakdown');

function formatNumber(num) {
    return Math.round(num).toLocaleString('de-DE');
}

function calculatePrice() {
    if (!flaecheSlider || !kioskeSlider) return;

    const flaeche = parseFloat(flaecheSlider.value);
    const kioske = parseInt(kioskeSlider.value);

    // Update display values
    if (flaecheValue) {
        flaecheValue.textContent = formatNumber(flaeche) + ' m²';
    }
    if (kioskeValue) {
        kioskeValue.textContent = kioske;
    }

    // Glatte, stetig steigende Preisberechnung (alle Preise verdoppelt)
    // Gesamtpreis steigt gleichmäßig von ~1.000€ bei 500m² auf ~40.000€ bei 120.000m²
    
    // Grundgebühr: steigt doppelt so steil wie Einrichtung
    // Einrichtung steigt von 150*0.75*2 = 225€ auf (150+1850)*0.75*2 = 3000€
    // Das ist eine Steigung von 2775€ über 120000m²
    // Grundgebühr steigt doppelt so steil: von 500*0.75*2 = 750€ auf 750 + 5550 = 6300€
    const basePriceStart = 500 * 0.75 * 2; // 750€ bei 500m²
    const basePriceEnd = basePriceStart + 5550; // 6300€ bei 120.000m²
    const basePrice = basePriceStart + ((flaeche - 500) / 119500) * (basePriceEnd - basePriceStart);
    
    // Einrichtung (steigt glatt mit der Größe, verdoppelt)
    const kioskSetupPrice = (150 + (flaeche / 120000) * 1850) * 0.75 * 2 * kioske;
    
    // Grundriss & Wegbeschreibungen: Gesamtpreis steigt immer monoton (verdoppelt)
    // Gesamtpreis steigt von ~3.000€ (500m²) auf ~36.000€ (120.000m²)
    let floorPlanPrice;
    if (flaeche <= 500) {
        floorPlanPrice = flaeche * 3.0 * 0.75 * 2;
    } else {
        // Verwende eine Wurzelfunktion für glatten, stetig steigenden Preis
        const floorPlanBasePrice = 500 * 3.0 * 0.75 * 2; // 2.250€ bei 500m²
        const floorPlanMaxPrice = 36000 * 0.75; // 27.000€ bei 120.000m² (Ziel)
        
        // Normalisiere die Fläche auf 0-1 (500m² = 0, 120.000m² = 1)
        const normalizedSize = (flaeche - 500) / 119500;
        
        // Verwende eine Wurzelfunktion für glatten Anstieg
        const sqrtFactor = Math.sqrt(normalizedSize);
        
        // Berechne Gesamtpreis: Basis + (Max - Basis) * sqrtFactor
        floorPlanPrice = floorPlanBasePrice + (floorPlanMaxPrice - floorPlanBasePrice) * sqrtFactor;
    }
    
    // Berechne Gesamtpreis (alle Preise sind bereits mit 0.75 und 2 multipliziert)
    const finalBaseFee = basePrice;
    const finalTotalKioskPrice = kioskSetupPrice;
    const finalFloorPlanPrice = floorPlanPrice;
    const finalTotalPrice = finalBaseFee + finalTotalKioskPrice + finalFloorPlanPrice;

    // Update result display
    if (resultPrice) {
        resultPrice.textContent = formatNumber(finalTotalPrice) + ' €';
    }
    if (resultBreakdown) {
        resultBreakdown.innerHTML = `
            <div class="result-item">
                <span>Grundgebühr:</span>
                <span>${formatNumber(finalBaseFee)} €</span>
            </div>
            <div class="result-item">
                <span>Einrichtung (${kioske} Interaktive Touch-Bildschirme):</span>
                <span>${formatNumber(finalTotalKioskPrice)} €</span>
            </div>
            <div class="result-item">
                <span>Grundriss & Wegbeschreibungen:</span>
                <span>${formatNumber(finalFloorPlanPrice)} €</span>
            </div>
            <div class="result-item" style="font-weight: 700; font-size: 1.1rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                <span>Gesamt:</span>
                <span>${formatNumber(finalTotalPrice)} €</span>
            </div>
        `;
    }
}

// Initialize calculator on page load
if (flaecheSlider && kioskeSlider) {
    // Calculate on slider change
    flaecheSlider.addEventListener('input', calculatePrice);
    kioskeSlider.addEventListener('input', calculatePrice);
    
    // Calculate initial price
    calculatePrice();
}

// Helper function to show notifications
function showNotification(message, type = 'success') {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // Add animation
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
    `;
    if (!document.querySelector('style[data-notification]')) {
        style.setAttribute('data-notification', 'true');
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Helper function to validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Contact Form with EmailJS - now handled directly in index.html

// FAQ Accordion
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    
    if (question) {
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active', !isActive);
        });
    }
});

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for fade-in animation
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.feature-card, .admin-card, .benefit-card, .process-step, .timeline-item');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Header scroll effect - hide on scroll down, show on scroll up
let lastScroll = 0;
const header = document.querySelector('.header');

if (header) {
    document.body.classList.add('has-fixed-header');

    const setHeaderHeight = () => {
        document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    };
    setHeaderHeight();
    window.addEventListener('resize', setHeaderHeight);

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        const scrollThreshold = 100; // Minimum scroll distance before hiding
        
        header.classList.toggle('is-scrolled', currentScroll > 10);
        
        // Hide/show header based on scroll direction
        if (currentScroll > scrollThreshold) {
            if (currentScroll > lastScroll) {
                // Scrolling down - hide header
                header.classList.add('is-hidden');
            } else {
                // Scrolling up - show header
                header.classList.remove('is-hidden');
            }
        } else {
            // Always show header when near top
            header.classList.remove('is-hidden');
        }
        
        lastScroll = currentScroll;
    });
}

// Navbar scroll effect (.navbar variant): hide on scroll down, show on scroll up
const navbar = document.querySelector('.navbar');
if (navbar) {
    // Make sure it's visible on load
    navbar.classList.add('visible');

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        const scrollThreshold = 100;

        if (currentScroll > scrollThreshold) {
            if (currentScroll > lastScroll) {
                navbar.classList.remove('visible');
            } else {
                navbar.classList.add('visible');
            }
        } else {
            navbar.classList.add('visible');
        }

        lastScroll = currentScroll;
    });
}
