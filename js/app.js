// BMI Calculator App

let currentUnit = 'metric';
let bmiData = null;

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.textContent = next === 'light' ? '🌙' : '☀️';
    });
}

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await i18n.initI18n();
    } catch (e) {
        console.warn('i18n init failed:', e);
    }
    hideLoader();
    setupEventListeners();
    loadHistory();
    calculateBMI(false);
    preserveLanguageLinks();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 단위 변경
    document.querySelectorAll('.unit-btn').forEach(btn => {
        btn.addEventListener('click', switchUnit);
    });

    // 계산 버튼
    document.getElementById('calculate-btn').addEventListener('click', calculateBMI);

    // 입력 필드 엔터 키
    document.getElementById('height-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') calculateBMI();
    });
    document.getElementById('weight-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') calculateBMI();
    });

    // 공유 버튼
    document.getElementById('share-btn')?.addEventListener('click', shareBMI);
    document.getElementById('save-card-btn')?.addEventListener('click', saveStoryCard);
    document.getElementById('share-twitter-btn')?.addEventListener('click', shareBMITwitter);
    document.getElementById('share-url-btn')?.addEventListener('click', copyBMIUrl);

    // 언어 선택
    document.getElementById('lang-toggle').addEventListener('click', toggleLanguageMenu);
    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            await i18n.setLanguage(e.target.dataset.lang);
            updateUI();
            if (bmiData) {
                displayResults(bmiData.bmi, bmiData.height, bmiData.weight);
                renderCuratedResources();
            }
            closeLanguageMenu();
        });
    });

    // 문서 클릭 시 언어 메뉴 닫기
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.language-selector')) {
            closeLanguageMenu();
        }
    });

    // GA4 engagement on first user input change
    let engageFired = false;
    function fireEngagement() {
        if (!engageFired) {
            engageFired = true;
            if (typeof gtag === 'function') {
                gtag('event', 'engagement', { event_category: 'bmi_calculator', event_label: 'first_interaction' });
            }
        }
    }

    // 실시간 계산 (입력 변경 시)
    document.getElementById('height-input').addEventListener('input', function() { fireEngagement(); calculateBMI(); });
    document.getElementById('weight-input').addEventListener('input', function() { fireEngagement(); calculateBMI(); });
}

// 단위 전환
function switchUnit(e) {
    const newUnit = e.target.dataset.unit;

    if (newUnit === currentUnit) return;

    const heightInput = document.getElementById('height-input');
    const weightInput = document.getElementById('weight-input');

    if (currentUnit === 'metric' && newUnit === 'imperial') {
        // cm -> ft/in, kg -> lb
        const heightCm = parseFloat(heightInput.value);
        const weightKg = parseFloat(weightInput.value);

        const heightFeet = heightCm / 30.48; // 1 ft = 30.48 cm
        const weightLb = weightKg * 2.20462; // 1 kg = 2.20462 lb

        heightInput.value = parseFloat(heightFeet.toFixed(2));
        weightInput.value = parseFloat(weightLb.toFixed(2));

        document.getElementById('height-unit').textContent = 'ft';
        document.getElementById('weight-unit').textContent = 'lb';
    } else {
        // ft -> cm, lb -> kg
        const heightFeet = parseFloat(heightInput.value);
        const weightLb = parseFloat(weightInput.value);

        const heightCm = heightFeet * 30.48;
        const weightKg = weightLb / 2.20462;

        heightInput.value = parseFloat(heightCm.toFixed(2));
        weightInput.value = parseFloat(weightKg.toFixed(2));

        document.getElementById('height-unit').textContent = 'cm';
        document.getElementById('weight-unit').textContent = 'kg';
    }

    currentUnit = newUnit;

    // 버튼 스타일 업데이트
    document.querySelectorAll('.unit-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.unit === newUnit);
    });

    calculateBMI();
}

// BMI 계산
function calculateBMI(isUserAction = true) {
    const heightInput = document.getElementById('height-input');
    const weightInput = document.getElementById('weight-input');

    const height = parseFloat(heightInput.value);
    const weight = parseFloat(weightInput.value);

    if (!height || !weight || height <= 0 || weight <= 0) {
        hideResults();
        return;
    }

    let bmi;
    if (currentUnit === 'metric') {
        // BMI = weight(kg) / (height(m))^2
        const heightM = height / 100;
        bmi = weight / (heightM * heightM);
    } else {
        // BMI = (weight(lb) / (height(in))^2) * 703
        const heightInches = height * 12;
        bmi = (weight / (heightInches * heightInches)) * 703;
    }

    bmi = parseFloat(bmi.toFixed(1));
    const categoryKey = bmi < 18.5 ? 'underweight' : (bmi < 25 ? 'normal' : (bmi < 30 ? 'overweight' : 'obese'));

    // 결과 저장
    bmiData = {
        bmi: bmi,
        categoryKey: categoryKey,
        height: height,
        weight: weight,
        unit: currentUnit,
        timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };

    displayResults(bmi, height, weight);
    drawGauge(bmi);
    renderCuratedResources();
    if (isUserAction) {
        addToHistory(bmi, height, weight);
        if (typeof gtag === 'function') {
            gtag('event', 'test_start', {
                event_category: 'bmi_calculator',
                app_name: 'bmi-calculator'
            });
            gtag('event', 'tool_use', {
                tool_name: 'bmi-calculator',
                action: 'calculate',
                result_type: categoryKey,
                unit: currentUnit
            });
            gtag('event', 'test_complete', {
                event_category: 'bmi_calculator',
                app_name: 'bmi-calculator',
                result_type: categoryKey
            });
        }
    }
}

// 결과 표시
function displayResults(bmi, height, weight) {
    const resultContainer = document.getElementById('result-container');
    const statusBadge = document.getElementById('status-badge');
    const statusEmoji = document.getElementById('status-emoji');
    const statusText = document.getElementById('status-text');

    let category, emoji, tip;

    if (bmi < 18.5) {
        category = i18n.t('bmi.underweight');
        emoji = '😔';
        tip = i18n.t('bmi.tipsUnderweight');
    } else if (bmi < 25) {
        category = i18n.t('bmi.normal');
        emoji = '😊';
        tip = i18n.t('bmi.tipsNormal');
    } else if (bmi < 30) {
        category = i18n.t('bmi.overweight');
        emoji = '😐';
        tip = i18n.t('bmi.tipsOverweight');
    } else {
        category = i18n.t('bmi.obese');
        emoji = '😟';
        tip = i18n.t('bmi.tipsObese');
    }

    statusEmoji.textContent = emoji;
    statusText.textContent = category;

    // BMI 값 표시
    document.getElementById('bmi-value').textContent = bmi.toFixed(1);

    // 상세 정보 표시
    if (currentUnit === 'metric') {
        document.getElementById('result-height').textContent = `${height} cm`;
        document.getElementById('result-weight').textContent = `${weight} kg`;
    } else {
        document.getElementById('result-height').textContent = `${height.toFixed(2)} ft`;
        document.getElementById('result-weight').textContent = `${weight.toFixed(2)} lb`;
    }
    document.getElementById('result-bmi-value').textContent = bmi.toFixed(1);

    // 이상적 체중 범위 계산
    const minBMI = 18.5;
    const maxBMI = 24.9;

    let minWeight, maxWeight;
    if (currentUnit === 'metric') {
        const heightM = height / 100;
        minWeight = (minBMI * heightM * heightM).toFixed(1);
        maxWeight = (maxBMI * heightM * heightM).toFixed(1);
        document.getElementById('min-weight').textContent = `${minWeight} kg`;
        document.getElementById('max-weight').textContent = `${maxWeight} kg`;
    } else {
        const heightInches = height * 12;
        minWeight = ((minBMI * heightInches * heightInches) / 703).toFixed(1);
        maxWeight = ((maxBMI * heightInches * heightInches) / 703).toFixed(1);
        document.getElementById('min-weight').textContent = `${minWeight} lb`;
        document.getElementById('max-weight').textContent = `${maxWeight} lb`;
    }

    // 건강 팁
    document.getElementById('tip-text').textContent = tip;

    resultContainer.classList.remove('hidden');
}

// 게이지 그리기
function drawGauge(bmi) {
    const canvas = document.getElementById('bmi-gauge');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    // Canvas 해상도 설정
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height * 0.8;
    const radius = 80;

    // 배경 그리기
    ctx.fillStyle = 'rgba(0, 184, 148, 0.1)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0, false);
    ctx.fill();

    // 색상 구간 그리기
    const segments = [
        { min: 0, max: 18.5, color: '#3498db', label: '저체중' },
        { min: 18.5, max: 25, color: '#00b894', label: '정상' },
        { min: 25, max: 30, color: '#f39c12', label: '과체중' },
        { min: 30, max: 50, color: '#e74c3c', label: '비만' }
    ];

    segments.forEach((segment) => {
        const startAngle = Math.PI + (segment.min / 50) * Math.PI;
        const endAngle = Math.PI + (segment.max / 50) * Math.PI;

        ctx.strokeStyle = segment.color;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
        ctx.stroke();
    });

    // 바늘 그리기
    const needleAngle = Math.PI + (Math.min(Math.max(bmi, 0), 50) / 50) * Math.PI;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(needleAngle - Math.PI / 2);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -radius + 10);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 범위 표시
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, Segoe UI';
    ctx.textAlign = 'center';

    ctx.fillText('0', centerX - radius - 10, centerY + 5);
    ctx.fillText('50', centerX + radius + 10, centerY + 5);
}

// 결과 숨기기
function hideResults() {
    document.getElementById('result-container').classList.add('hidden');
}

// 히스토리에 추가
function addToHistory(bmi, height, weight) {
    let history = JSON.parse(localStorage.getItem('bmiHistory') || '[]');

    const entry = {
        bmi: bmi,
        height: height,
        weight: weight,
        unit: currentUnit,
        date: new Date().toLocaleString()
    };

    history.unshift(entry);
    if (history.length > 10) history.pop();

    localStorage.setItem('bmiHistory', JSON.stringify(history));
    loadHistory();
}

// 히스토리 로드
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('bmiHistory') || '[]');
    const historyList = document.getElementById('calc-history');

    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-message">' + i18n.t('history.empty') + '</p>';
        return;
    }

    historyList.innerHTML = history.map(entry => {
        const unit = entry.unit === 'metric' ? 'cm/kg' : 'ft/lb';
        return `
            <div class="history-item">
                <span class="history-item-text">
                    BMI: <strong>${entry.bmi.toFixed(1)}</strong>
                    (${entry.height.toFixed(1)} ${unit.split('/')[0]} / ${entry.weight.toFixed(1)} ${unit.split('/')[1]})
                </span>
                <span class="history-item-time">${new Date(entry.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        `;
    }).join('');
}

// 히스토리 삭제
let _bmiClearConfirmTimer = null;
function clearHistory() {
    const clearBtn = document.getElementById('clear-history-btn') || document.querySelector('[onclick*="clearHistory"]');
    if (clearBtn && !clearBtn.dataset.confirmPending) {
        clearBtn.dataset.confirmPending = '1';
        showBmiToast(i18n.t('history.confirmClear') || 'Tap again to clear all history.');
        clearTimeout(_bmiClearConfirmTimer);
        _bmiClearConfirmTimer = setTimeout(() => {
            if (clearBtn) delete clearBtn.dataset.confirmPending;
        }, 3000);
        return;
    }
    if (clearBtn) delete clearBtn.dataset.confirmPending;
    clearTimeout(_bmiClearConfirmTimer);
    localStorage.removeItem('bmiHistory');
    loadHistory();
}

function getActiveLang() {
    return (window.i18n && window.i18n.currentLang) || new URLSearchParams(window.location.search).get('lang') || 'en';
}

function getShareUrl() {
    return `https://dopabrain.com/bmi-calculator/?lang=${encodeURIComponent(getActiveLang())}&utm_source=share`;
}

function showBmiToast(msg) {
    let toast = document.getElementById('bmi-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'bmi-toast';
        toast.className = 'bmi-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function getAmazonDomain(lang) {
    const map = { ja: 'amazon.co.jp', de: 'amazon.de', fr: 'amazon.fr', es: 'amazon.es', hi: 'amazon.in' };
    return map[lang] || 'amazon.com';
}

function renderCuratedResources() {
    const container = document.getElementById('curated-resources-card');
    if (!container || !bmiData) return;
    const t = (key, fb) => {
        const val = window.i18n?.t?.(key);
        return val && val !== key ? val : fb;
    };
    const lang = getActiveLang();
    const domain = getAmazonDomain(lang);
    const items = [
        {
            key: 'howNotToDiet',
            asin: '1250199220',
            title: t('curated.gregerTitle', 'How Not to Diet — Michael Greger'),
            desc: t('curated.gregerDesc', 'Evidence-based nutritional framework for healthy metabolic balance and sustainable body composition.')
        },
        {
            key: 'outlive',
            asin: '0593236599',
            title: t('curated.attiaTitle', 'Outlive — Peter Attia'),
            desc: t('curated.attiaDesc', 'Modern preventive science covering metabolic health, muscle strength, and longevity fundamentals.')
        }
    ];

    container.innerHTML = `
        <div class="curated-resources-header">
            <h3 class="curated-resources-title">${t('curated.title', 'Recommended Metabolic & Nutrition Books')}</h3>
            <span class="curated-disclosure">${t('curated.disclosure', 'Affiliate links')}</span>
        </div>
        <p class="curated-resources-subtitle">${t('curated.subtitle', 'Explore physician-authored resources on nutrition, strength, and healthy metabolic habits.')}</p>
        <div class="curated-list">
            ${items.map(item => `
                <a class="curated-item" href="https://www.${domain}/dp/${item.asin}?tag=dopabrain-20" target="_blank" rel="noopener sponsored nofollow" data-resource-key="${item.key}">
                    <div class="curated-item-top">
                        <span class="curated-item-title">${item.title}</span>
                        <span class="curated-item-cta">${t('curated.cta', 'View Book ->')}</span>
                    </div>
                    <span class="curated-item-desc">${item.desc}</span>
                </a>
            `).join('')}
        </div>`;
    container.style.display = 'block';

    container.querySelectorAll('.curated-item').forEach(link => {
        link.addEventListener('click', () => {
            if (typeof gtag === 'function') {
                gtag('event', 'curated_resource_click', {
                    app_name: 'bmi-calculator',
                    resource_key: link.getAttribute('data-resource-key'),
                    result_type: bmiData.categoryKey || 'normal',
                    content_locale: lang,
                    cta_surface: 'curated_resources'
                });
                gtag('event', 'content_cta_click', {
                    cta_type: 'curated_book',
                    destination: link.getAttribute('href'),
                    source: 'bmi-calculator'
                });
            }
        });
    });
}

function saveStoryCard() {
    const canvas = document.getElementById('share-canvas');
    if (!canvas || !bmiData) return;
    const t = (key, fb) => {
        const val = window.i18n?.t?.(key);
        return val && val !== key ? val : fb;
    };
    const lang = getActiveLang();
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#071418');
    grad.addColorStop(0.5, '#0c2329');
    grad.addColorStop(1, '#102a43');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.fillStyle = 'rgba(0, 184, 148, 0.16)';
    ctx.beginPath();
    ctx.arc(880, 280, 260, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(0, 184, 148, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(72, 120, 936, 1680, 44);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#55efc4';
    ctx.font = '700 32px Inter, sans-serif';
    ctx.fillText('DOPABRAIN HEALTH SCREENING', 540, 235);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 56px Inter, sans-serif';
    ctx.fillText(t('header.title', 'BMI Calculator'), 540, 330);

    const statusText = document.getElementById('status-text')?.textContent || t(`bmi.${bmiData.categoryKey}`, 'Normal');
    const emojiText = document.getElementById('status-emoji')?.textContent || '😊';
    ctx.font = '700 120px Inter, sans-serif';
    ctx.fillText(emojiText, 540, 560);

    ctx.fillStyle = '#00b894';
    ctx.font = '800 130px Inter, sans-serif';
    ctx.fillText(bmiData.bmi.toFixed(1), 540, 740);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 34px Inter, sans-serif';
    ctx.fillText(t('bmi.unit', 'BMI'), 540, 800);

    ctx.fillStyle = 'rgba(0, 184, 148, 0.2)';
    ctx.beginPath();
    ctx.roundRect(240, 860, 600, 92, 46);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 42px Inter, sans-serif';
    ctx.fillText(statusText, 540, 920);

    const minText = document.getElementById('min-weight')?.textContent || '';
    const maxText = document.getElementById('max-weight')?.textContent || '';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.roundRect(140, 1050, 800, 250, 28);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 30px Inter, sans-serif';
    ctx.fillText(t('bmi.idealWeightTitle', 'Ideal Weight Range'), 540, 1130);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 46px Inter, sans-serif';
    ctx.fillText(`${minText} – ${maxText}`, 540, 1215);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 26px Inter, sans-serif';
    ctx.fillText(t('bmi.idealWeightNote', 'WHO standard normal weight range (BMI 18.5-24.9)'), 540, 1270);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 30px Inter, sans-serif';
    ctx.fillText('dopabrain.com/bmi-calculator/', 540, 1700);

    try {
        const a = document.createElement('a');
        a.download = `bmi-card-${lang}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    } catch (e) {}

    showBmiToast(t('share.saved', 'Story card saved (1080×1920)!'));
    if (typeof gtag === 'function') {
        gtag('event', 'save_image', {
            event_category: 'bmi_calculator',
            app_name: 'bmi-calculator',
            result_type: bmiData.categoryKey || 'normal',
            save_surface: 'result_story_1080x1920'
        });
    }
}

// BMI 결과 공유 (Privacy-first URL without raw numeric score leakage)
function shareBMI() {
    if (!bmiData) return;
    const shareUrl = getShareUrl();
    const title = (window.i18n?.t?.('header.title') && i18n.t('header.title') !== 'header.title') ? i18n.t('header.title') : 'BMI Calculator';
    const text = `${title} — ${shareUrl}`;

    if (navigator.share) {
        navigator.share({ title, text, url: shareUrl }).catch(() => {});
        if (typeof gtag === 'function') {
            gtag('event', 'share', { method: 'native', content_type: 'bmi_card' });
        }
    } else {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showBmiToast(i18n.t('share.copied') || 'Copied!');
        }).catch(() => {
            showBmiToast(i18n.t('share.copied') || 'Copied!');
        });
        if (typeof gtag === 'function') {
            gtag('event', 'share', { method: 'copy', content_type: 'bmi_card' });
        }
    }
}

function shareBMITwitter() {
    const shareUrl = getShareUrl();
    const tpl = i18n.t('share.twitterText');
    const tweetText = (tpl && tpl !== 'share.twitterText') ? tpl : 'Check your BMI & WHO healthy weight range at DopaBrain';
    window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent(tweetText), '_blank', 'noopener');
    if (typeof gtag === 'function') {
        gtag('event', 'share', { method: 'twitter', content_type: 'bmi_card' });
    }
}

function copyBMIUrl() {
    const shareUrl = getShareUrl();
    navigator.clipboard.writeText(shareUrl).then(() => {
        showBmiToast(i18n.t('share.copied') || 'Copied!');
    }).catch(() => {
        showBmiToast(i18n.t('share.copied') || 'Copied!');
    });
    if (typeof gtag === 'function') {
        gtag('event', 'share', { method: 'url_copy', content_type: 'bmi_card' });
    }
}

// 언어 메뉴 토글
function toggleLanguageMenu() {
    const menu = document.getElementById('lang-menu');
    menu.classList.toggle('hidden');
}

// 언어 메뉴 닫기
function closeLanguageMenu() {
    document.getElementById('lang-menu').classList.add('hidden');
}

// 로더 숨기기
function hideLoader() {
    const loader = document.getElementById('app-loader');
    const delay = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 50 : 300;
    setTimeout(() => {
        loader.classList.add('hidden');
    }, delay);
}

// UI 업데이트
function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n;
        element.textContent = i18n.t(key);
    });
    loadHistory();
    preserveLanguageLinks();
}

function preserveLanguageLinks() {
    try {
        const lang = (window.i18n && window.i18n.currentLang) || new URLSearchParams(window.location.search).get('lang') || 'en';
        document.querySelectorAll('.related-card, a[href^="/biorhythm/"], a[href^="/life-in-numbers/"], a[href^="/stress-check/"], a[href^="/detox-timer/"]').forEach(function(a) {
            const href = a.getAttribute('href');
            if (!href || href.startsWith('/portal/')) return;
            const url = new URL(href, window.location.origin);
            if (lang) {
                url.searchParams.set('lang', lang);
            }
            url.searchParams.set('source', 'bmi_calculator_result');
            a.setAttribute('href', url.pathname + url.search + url.hash);

            if (!a.__ctaBound) {
                a.__ctaBound = true;
                a.addEventListener('click', function() {
                    recordGA4Event('content_cta_click', {
                        cta_surface: 'related_tools',
                        destination: a.getAttribute('href'),
                        source: 'bmi_calculator_result',
                        lang: lang || 'en'
                    });
                });
            }
        });
    } catch (e) {}
}

// GA4 이벤트 기록
function recordGA4Event(eventName, params = {}) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, params);
    }
}

// GA4 engagement tracking (scroll)
(function() {
    let scrollFired = false;
    window.addEventListener('scroll', function() {
        if (!scrollFired && window.scrollY > 100) {
            scrollFired = true;
            if (typeof gtag === 'function') gtag('event', 'scroll_engagement', { engagement_type: 'scroll' });
        }
    }, { passive: true });
})();
