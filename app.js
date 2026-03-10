// Constants and State
const REFRESH_INTERVAL_MS = 600000; // 10 minutes

// API Endpoints based on topic
const API_URLS = {
    inspirational: 'https://api.quotable.io/random?tags=inspirational',
    wisdom: 'https://api.quotable.io/random?tags=wisdom',
    success: 'https://api.quotable.io/random?tags=success',
    love: 'https://api.quotable.io/random?tags=love',
    movies: 'https://raw.githubusercontent.com/skv86/movie-quotes-db/main/quotes.json' // Fallback to local hardcoded list if fetch fails
};

// High quality background search terms based on topic
const BG_TERMS = {
    inspirational: ['nature', 'mountain', 'sunrise', 'landscape', 'clouds'],
    wisdom: ['forest', 'abstract', 'calm', 'minimalist', 'texture'],
    success: ['architecture', 'cityscape', 'space', 'ocean', 'peaks'],
    love: ['sunset', 'flowers', 'warm', 'romantic', 'soft'],
    movies: ['cinematic', 'moody', 'dark', 'film', 'neon']
};

// Hardcoded movie quotes fallback with more philosophical/impactful selection
const MOVIE_QUOTES = [
    { content: "It is not our abilities that show what we truly are… it is our choices.", author: "Albus Dumbledore, Harry Potter" },
    { content: "All we have to decide is what to do with the time that is given us.", author: "Gandalf, The Lord of the Rings" },
    { content: "Do, or do not. There is no try.", author: "Yoda, Star Wars" },
    { content: "Oh yes, the past can hurt. But you can either run from it, or learn from it.", author: "Rafiki, The Lion King" },
    { content: "Great men are not born great, they grow great.", author: "Don Vito Corleone, The Godfather" },
    { content: "Some people can’t believe in themselves until someone else believes in them first.", author: "Sean Maguire, Good Will Hunting" },
    { content: "It’s what you do right now that makes a difference.", author: "Struecker, Black Hawk Down" }
];

let isFullscreen = false;
let currentBgIndex = 1;
let refreshTimer = null;
let isInitialLoad = true;
let preloadedQuote = null;
let preloadedImage = null;
let currentTopic = 'inspirational';

// DOM Elements
const quoteText = document.getElementById('quote-text');
const quoteAuthor = document.getElementById('quote-author');
const bg1 = document.getElementById('bg-1');
const bg2 = document.getElementById('bg-2');
const refreshBtn = document.getElementById('refresh-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const topicOptions = document.querySelectorAll('.topic-pill');
const timeEl = document.getElementById('clock-time');
const dateEl = document.getElementById('clock-date');
const container = document.getElementById('container');

// Welcome Screen Elements
const welcomeScreen = document.getElementById('welcome-screen');
const diveInBtn = document.getElementById('dive-in-btn');

// --- Initialization ---
function init() {
    updateClock();
    setInterval(updateClock, 1000);
    
    // Load saved topic if any
    const savedTopic = localStorage.getItem('screensaverTopic');
    if (savedTopic && BG_TERMS[savedTopic]) {
        currentTopic = savedTopic;
        updateTopicUI(savedTopic);
    }

    // Check if user has already entered
    const hasEntered = localStorage.getItem('hasEntered');
    if (hasEntered === 'true') {
        welcomeScreen.classList.remove('active');
        document.body.classList.remove('welcome-active');
        welcomeScreen.style.display = 'none';
        fetchNewContent();
        startTimer();
    }

    // Dive In Button Logic
    diveInBtn.addEventListener('click', startExperience);

    // Setup other event listeners
    refreshBtn.addEventListener('click', forceRefresh);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Settings Listeners
    settingsBtn.addEventListener('click', toggleSettings);
    closeSettingsBtn.addEventListener('click', toggleSettings);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) toggleSettings();
    });

    topicOptions.forEach(option => {
        option.addEventListener('click', () => {
            const newTopic = option.dataset.topic;
            if (newTopic === currentTopic) return; // Ignore if already selected
            
            currentTopic = newTopic;
            localStorage.setItem('screensaverTopic', currentTopic);
            updateTopicUI(currentTopic);
            
            isInitialLoad = true; // Force fresh fetch vs preloaded
            preloadedQuote = null;
            preloadedImage = null;
            forceRefresh();
        });
    });

    // Keybindings
    document.addEventListener('keydown', (e) => {
        if (settingsModal.classList.contains('active')) {
            if (e.key === 'Escape') toggleSettings();
            return; // Don't trigger other shortcuts while in settings
        }
        
        // Disable shortcuts if welcome screen is active
        if (welcomeScreen.classList.contains('active')) {
            return;
        }

        switch(e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                forceRefresh();
                break;
            case 'f':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 's':
                e.preventDefault();
                toggleSettings();
                break;
        }
    });

    // We no longer call startTimer() here. It waits for Dive In.
}

function startExperience() {
    // Save state
    localStorage.setItem('hasEntered', 'true');

    // Trigger fluid CSS exit animation
    welcomeScreen.classList.remove('active');
    welcomeScreen.classList.add('closing');
    
    document.body.classList.remove('welcome-active'); // Unblur content
    
    // Wait for the 1.2s welcome screen transition before fetching first content
    setTimeout(() => {
        fetchNewContent();
        startTimer();
    }, 1000); // Fetch slightly before animation fully ends for seamless feel
}

function forceRefresh() {
    resetTimer();
    fetchNewContent();
}

function toggleSettings() {
    const isActive = settingsModal.classList.contains('active');
    
    if (isActive) {
        settingsModal.classList.remove('active');
        document.body.classList.remove('settings-open');
    } else {
        settingsModal.classList.add('active');
        document.body.classList.add('settings-open');
    }
}

function updateTopicUI(topicId) {
    topicOptions.forEach(opt => {
        if (opt.dataset.topic === topicId) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });
}

// --- Fetching Logic ---
async function fetchNewContent() {
    if (isInitialLoad || !preloadedQuote || !preloadedImage) {
        quoteText.classList.add('loading');
        const [quoteData, imageUrl] = await Promise.all([fetchQuote(), fetchImage()]);
        isInitialLoad = false;
        displayContent(quoteData, imageUrl);
        preloadNextContent();
    } else {
        displayContent(preloadedQuote, preloadedImage);
        preloadedQuote = null;
        preloadedImage = null;
        preloadNextContent();
    }
}

async function preloadNextContent() {
    try {
        const [quoteData, imageUrl] = await Promise.all([fetchQuote(), fetchImage()]);
        preloadedQuote = quoteData;
        preloadedImage = imageUrl;
        const img = new Image();
        img.src = imageUrl;
    } catch (e) {
        console.error("Failed to preload:", e);
    }
}

function displayContent(quoteData, imageUrl) {
    quoteText.classList.remove('visible');
    quoteAuthor.classList.remove('visible');
    quoteText.classList.remove('loading');
    
    updateBackground(imageUrl);

    setTimeout(() => {
        quoteText.textContent = `"${quoteData.content}"`;
        quoteAuthor.textContent = quoteData.author;
        quoteText.classList.add('visible');
        quoteAuthor.classList.add('visible');
    }, 400); 
}

async function fetchQuote() {
    if (currentTopic === 'movies') {
        // Since public movie quote APIs are constantly changing/rate limiting,
        // we fallback to our internal list for guaranteed high quality performance
        const randomQuote = MOVIE_QUOTES[Math.floor(Math.random() * MOVIE_QUOTES.length)];
        return randomQuote;
    }

    try {
        const url = API_URLS[currentTopic] || API_URLS['inspirational'];
        const response = await fetch(url);
        if (!response.ok) throw new Error('API failed');
        const data = await response.json();
        // quotable returns array for tags, or single object
        const item = Array.isArray(data) ? data[0] : data;
        return { content: item.content, author: item.author };
    } catch (error) {
        console.log(`Failed fetching ${currentTopic} quote, falling back...`);
        // Fallback generic quote
        return {
            content: "The only limit to our realization of tomorrow will be our doubts of today.",
            author: "Franklin D. Roosevelt"
        };
    }
}

async function fetchImage() {
    const terms = BG_TERMS[currentTopic] || BG_TERMS['inspirational'];
    const term = terms[Math.floor(Math.random() * terms.length)];
    return `https://source.unsplash.com/1920x1080/?${term}&sig=${new Date().getTime()}`;
}

// --- UI Updates ---
function updateBackground(imageUrl) {
    // We use two background divs to crossfade smoothly without white flashes
    const nextBgIndex = currentBgIndex === 1 ? 2 : 1;
    const currentBgEl = document.getElementById(`bg-${currentBgIndex}`);
    const nextBgEl = document.getElementById(`bg-${nextBgIndex}`);

    // Preload image before setting to avoid downloading flash
    const img = new Image();
    img.onload = () => {
        nextBgEl.style.backgroundImage = `url('${imageUrl}')`;
        nextBgEl.classList.add('bg-active');
        currentBgEl.classList.remove('bg-active');
        currentBgIndex = nextBgIndex;
    };
    // Fallback if Unsplash fails, use picsum
    img.onerror = () => {
        const fallbackUrl = `https://picsum.photos/1920/1080?random=${new Date().getTime()}`;
        nextBgEl.style.backgroundImage = `url('${fallbackUrl}')`;
        nextBgEl.classList.add('bg-active');
        currentBgEl.classList.remove('bg-active');
        currentBgIndex = nextBgIndex;
    }
    img.src = imageUrl;
}

function updateClock() {
    const now = new Date();
    
    // Format Time (e.g., 14:30 or 02:30 PM depending on locale preference. We'll use 24h for a cleaner look)
    let hours = now.getHours();
    let minutes = now.getMinutes();
    
    // Pad with zero
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    
    timeEl.textContent = `${hours}:${minutes}`;

    // Format Date
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString(undefined, options);
}

// --- Timer Management ---
function startTimer() {
    refreshTimer = setInterval(fetchNewContent, REFRESH_INTERVAL_MS);
}

function resetTimer() {
    clearInterval(refreshTimer);
    startTimer();
}

// --- Fullscreen Handling ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Request fullscreen on the container
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.mozRequestFullScreen) { /* Firefox */
            container.mozRequestFullScreen();
        } else if (container.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) { /* IE/Edge */
            container.msRequestFullscreen();
        }
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        document.body.classList.add('is-fullscreen');
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { /* Firefox */
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE/Edge */
            document.msExitFullscreen();
        }
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        document.body.classList.remove('is-fullscreen');
    }
}

// Listen for fullscreen changes (e.g. user pressing ESC) to update the button icon
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        document.body.classList.remove('is-fullscreen');
    } else {
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        document.body.classList.add('is-fullscreen');
    }
});

// Start app
init();
