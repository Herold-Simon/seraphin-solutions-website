// Mobile Navigation Toggle
var hamburger = document.getElementById('hamburger');
var nav = document.getElementById('nav');

if (hamburger && nav) {
    hamburger.addEventListener('click', function() {
        nav.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    nav.querySelectorAll('.nav-link').forEach(function(link) {
        link.addEventListener('click', function() {
            nav.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });

    document.addEventListener('click', function(e) {
        if (!nav.contains(e.target) && !hamburger.contains(e.target)) {
            nav.classList.remove('active');
            hamburger.classList.remove('active');
        }
    });
}

// Navbar variant toggle (.navbar + .nav-menu)
var navbarHamburger = document.querySelector('.navbar .hamburger');
var navbarMenu = document.querySelector('.navbar .nav-menu');

if (navbarHamburger && navbarMenu) {
    navbarHamburger.addEventListener('click', function(e) {
        e.stopPropagation();
        navbarMenu.classList.toggle('active');
    });

    navbarMenu.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
            navbarMenu.classList.remove('active');
        });
    });

    document.addEventListener('click', function(e) {
        if (!navbarMenu.contains(e.target) && !navbarHamburger.contains(e.target)) {
            navbarMenu.classList.remove('active');
        }
    });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        var href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
            e.preventDefault();
            var target = document.querySelector(href);
            if (target) {
                var headerOffset = 80;
                var top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        }
    });
});

// References Carousel
var carousel = document.getElementById('carousel');
var carouselPrev = document.getElementById('carouselPrev');
var carouselNext = document.getElementById('carouselNext');
var currentSlide = 0;

if (carousel && carouselPrev && carouselNext) {
    var track = document.getElementById('carouselTrack');
    var slides = carousel.querySelectorAll('.carousel-slide');
    var totalSlides = slides.length;

    if (totalSlides > 1) {
        carouselPrev.style.display = 'flex';
        carouselNext.style.display = 'flex';
    }

    function showSlide(index) {
        currentSlide = index;
        if (track) {
            track.style.transform = 'translateX(-' + (index * 100) + '%)';
        }
        slides.forEach(function(slide, i) {
            slide.classList.toggle('active', i === index);
        });
    }

    if (totalSlides > 1) {
        carouselNext.addEventListener('click', function() {
            currentSlide = (currentSlide + 1) % totalSlides;
            showSlide(currentSlide);
        });
        carouselPrev.addEventListener('click', function() {
            currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
            showSlide(currentSlide);
        });
    }
    showSlide(0);
}

// Price Calculator
var flaecheSlider = document.getElementById('flaeche');
var kioskeSlider = document.getElementById('kioske');
var kioskeValue = document.getElementById('kioskeValue');
var resultPrice = document.getElementById('resultPrice');
var resultBreakdown = document.getElementById('resultBreakdown');

function formatNumber(num) {
    return Math.round(num).toLocaleString('de-DE');
}

function calculatePrice() {
    if (!flaecheSlider || !kioskeSlider) return;

    var flaecheInput = document.getElementById('flaecheInput');
    var inputVal = flaecheInput ? parseFloat(flaecheInput.value) : NaN;
    var flaeche = (flaecheInput && !isNaN(inputVal) && flaecheInput.value.trim() !== '')
        ? Math.max(0, inputVal)
        : parseFloat(flaecheSlider.value);
    var kioske = parseInt(kioskeSlider.value);

    if (kioskeValue) kioskeValue.textContent = kioske;

    var N = 119500;
    var basePrice = flaeche <= 500 ? 750 : 750 + (flaeche - 500) * (5550 / 119500);
    var kioskSetupPrice = (150 + flaeche * (1850 / 120000)) * (3 / 2) * kioske;
    var floorPlanPrice;
    if (flaeche <= 500) {
        floorPlanPrice = flaeche * (9 / 2);
    } else {
        var k = (flaeche - 500) / N;
        floorPlanPrice = 2250 + 24750 * Math.sqrt(k);
    }
    var finalBaseFee = basePrice * (9 / 16);
    var finalTotalKioskPrice = kioskSetupPrice * (3 / 4);
    var finalFloorPlanPrice = floorPlanPrice * (3 / 4);
    var finalTotalPrice = finalBaseFee + finalTotalKioskPrice + finalFloorPlanPrice;

    if (resultPrice) {
        resultPrice.textContent = formatNumber(finalTotalPrice) + ' \u20AC';
    }
    if (resultBreakdown) {
        resultBreakdown.innerHTML =
            '<div class="result-item"><span>Grundgebühr:</span><span>' + formatNumber(finalBaseFee) + ' \u20AC</span></div>' +
            '<div class="result-item"><span>Einrichtung (' + kioske + ' Bildschirm' + (kioske > 1 ? 'e' : '') + '):</span><span>' + formatNumber(finalTotalKioskPrice) + ' \u20AC</span></div>' +
            '<div class="result-item"><span>Grundriss & Wegbeschreibungen:</span><span>' + formatNumber(finalFloorPlanPrice) + ' \u20AC</span></div>' +
            '<div class="result-item" style="font-weight:700;font-size:0.9375rem;margin-top:8px;padding-top:8px;border-top:1px solid var(--color-border)"><span>Gesamt:</span><span>' + formatNumber(finalTotalPrice) + ' \u20AC</span></div>';
    }
}

// Hold-to-repeat for +/- buttons
function setupHoldRepeat(btn, onAction) {
    var repeatTimer = null;
    var intervalId = null;

    function start() {
        stop();
        onAction();
        repeatTimer = setTimeout(function() {
            repeatTimer = null;
            intervalId = setInterval(onAction, 80);
        }, 400);
    }

    function stop() {
        if (repeatTimer) { clearTimeout(repeatTimer); repeatTimer = null; }
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
    }

    btn.addEventListener('mousedown', function(e) { e.preventDefault(); start(); });
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); start(); });
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
}

if (flaecheSlider && kioskeSlider) {
    var flaecheInput = document.getElementById('flaecheInput');
    var kioskeMinus = document.getElementById('kioskeMinus');
    var kioskePlus = document.getElementById('kioskePlus');
    var flaecheMinus = document.getElementById('flaecheMinus');
    var flaechePlus = document.getElementById('flaechePlus');

    flaecheSlider.addEventListener('input', function() {
        if (flaecheInput) flaecheInput.value = flaecheSlider.value;
        calculatePrice();
    });

    if (flaecheInput) {
        flaecheInput.addEventListener('input', function() {
            var val = parseFloat(flaecheInput.value);
            if (!isNaN(val)) {
                flaecheSlider.value = Math.min(120000, Math.max(500, val));
            }
            calculatePrice();
        });
        flaecheInput.addEventListener('change', function() {
            var val = parseFloat(flaecheInput.value);
            if (!isNaN(val) && val >= 0) {
                flaecheSlider.value = Math.min(120000, Math.max(500, val));
            } else {
                flaecheInput.value = flaecheSlider.value;
            }
            calculatePrice();
        });
    }

    if (flaecheMinus) {
        setupHoldRepeat(flaecheMinus, function() {
            var v = Math.max(0, parseFloat(flaecheInput ? flaecheInput.value : flaecheSlider.value) - 500);
            if (flaecheInput) flaecheInput.value = Math.round(v);
            flaecheSlider.value = Math.min(120000, Math.max(500, Math.round(v)));
            calculatePrice();
        });
    }
    if (flaechePlus) {
        setupHoldRepeat(flaechePlus, function() {
            var v = parseFloat(flaecheInput ? flaecheInput.value : flaecheSlider.value) + 500;
            if (flaecheInput) flaecheInput.value = Math.round(v);
            flaecheSlider.value = Math.min(120000, Math.max(500, Math.round(v)));
            calculatePrice();
        });
    }

    if (kioskeMinus) {
        setupHoldRepeat(kioskeMinus, function() {
            var v = Math.max(1, parseInt(kioskeSlider.value) - 1);
            kioskeSlider.value = v;
            if (kioskeValue) kioskeValue.textContent = v;
            calculatePrice();
        });
    }
    if (kioskePlus) {
        setupHoldRepeat(kioskePlus, function() {
            var v = Math.min(20, parseInt(kioskeSlider.value) + 1);
            kioskeSlider.value = v;
            if (kioskeValue) kioskeValue.textContent = v;
            calculatePrice();
        });
    }

    kioskeSlider.addEventListener('input', function() {
        if (kioskeValue) kioskeValue.textContent = kioskeSlider.value;
        calculatePrice();
    });

    calculatePrice();
}

// Notification helper
function showNotification(message, type) {
    var existing = document.querySelector('.notification');
    if (existing) existing.remove();

    var el = document.createElement('div');
    el.className = 'notification';
    el.style.cssText = 'position:fixed;top:20px;right:20px;background:' +
        (type === 'success' ? '#32A71A' : '#ef4444') +
        ';color:#fff;padding:14px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;max-width:400px;font-size:0.9375rem;line-height:1.5;animation:notifIn .3s ease';
    el.textContent = message;

    if (!document.querySelector('style[data-notif]')) {
        var s = document.createElement('style');
        s.setAttribute('data-notif', '1');
        s.textContent = '@keyframes notifIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
        document.head.appendChild(s);
    }

    document.body.appendChild(el);
    setTimeout(function() {
        el.style.animation = 'notifIn .3s ease reverse';
        setTimeout(function() { el.remove(); }, 300);
    }, 5000);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// FAQ Accordion
document.querySelectorAll('.faq-item').forEach(function(item) {
    var question = item.querySelector('.faq-question');
    if (question) {
        question.addEventListener('click', function() {
            var isActive = item.classList.contains('active');
            document.querySelectorAll('.faq-item').forEach(function(other) {
                if (other !== item) other.classList.remove('active');
            });
            item.classList.toggle('active', !isActive);
        });
    }
});

// Header hide/show on scroll
var lastScroll = 0;
var header = document.querySelector('.header');

if (header) {
    document.body.classList.add('has-fixed-header');

    var setHeaderHeight = function() {
        document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    };
    setHeaderHeight();
    window.addEventListener('resize', setHeaderHeight);

    window.addEventListener('scroll', function() {
        var currentScroll = window.pageYOffset;
        header.classList.toggle('is-scrolled', currentScroll > 10);

        if (currentScroll > 100) {
            if (currentScroll > lastScroll) {
                header.classList.add('is-hidden');
            } else {
                header.classList.remove('is-hidden');
            }
        } else {
            header.classList.remove('is-hidden');
        }
        lastScroll = currentScroll;
    });
}

// Navbar variant scroll effect
var navbar = document.querySelector('.navbar');
if (navbar) {
    navbar.classList.add('visible');
    window.addEventListener('scroll', function() {
        var currentScroll = window.pageYOffset;
        if (currentScroll > 100) {
            navbar.classList.toggle('visible', currentScroll <= lastScroll);
        } else {
            navbar.classList.add('visible');
        }
        lastScroll = currentScroll;
    });
}
