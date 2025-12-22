/**
 * UtterOn - Client-side training logic
 * Handles localStorage completion tracking and training interface
 */

const STORAGE_KEY = 'utteron_completions';

// ============================================
// localStorage Helpers
// ============================================

function getCompletions() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveCompletions(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function getGroupCompletion(lang, groupId) {
    const completions = getCompletions();
    const today = getTodayDate();

    if (completions[lang] && completions[lang][groupId]) {
        const groupData = completions[lang][groupId];
        // Reset if date doesn't match
        if (groupData.date !== today) {
            return null;
        }
        return groupData;
    }
    return null;
}

function markExerciseComplete(lang, groupId, sentenceId, exerciseType) {
    const completions = getCompletions();
    const today = getTodayDate();

    // Initialize structure
    if (!completions[lang]) completions[lang] = {};
    if (!completions[lang][groupId]) {
        completions[lang][groupId] = { date: today, sentences: {} };
    }

    // Reset if date changed
    if (completions[lang][groupId].date !== today) {
        completions[lang][groupId] = { date: today, sentences: {} };
    }

    // Initialize sentence
    if (!completions[lang][groupId].sentences[sentenceId]) {
        completions[lang][groupId].sentences[sentenceId] = { listen: false, read: false };
    }

    // Mark complete
    completions[lang][groupId].sentences[sentenceId][exerciseType] = true;

    saveCompletions(completions);
}

function isGroupComplete(lang, groupId, sentenceIds) {
    const groupData = getGroupCompletion(lang, groupId);
    if (!groupData) return false;

    return sentenceIds.every(id => {
        const sentence = groupData.sentences[id];
        return sentence && sentence.listen && sentence.read;
    });
}

// ============================================
// Group List Page - Update card metadata
// ============================================

function formatRelativeDate(dateStr) {
    if (!dateStr) return 'Never';

    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return '1 week ago';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} month(s) ago`;
}

function updateGroupCards(lang) {
    const cards = document.querySelectorAll('.group-card');
    const completions = getCompletions();
    const today = getTodayDate();

    cards.forEach(card => {
        const groupId = card.dataset.groupId;
        const sentencesData = card.dataset.sentences;
        let sentences = [];

        try {
            sentences = JSON.parse(sentencesData);
        } catch (e) { }

        const totalExercises = sentences.length * 2; // listen + read for each

        // Get completion data for this group
        const groupData = completions[lang]?.[groupId];

        // Calculate score and today status
        let completedToday = 0;
        let lastPracticedDate = null;

        if (groupData && groupData.sentences) {
            // Check if data is from today
            const isToday = groupData.date === today;

            if (isToday) {
                // Count completed exercises
                Object.values(groupData.sentences).forEach(s => {
                    if (s.listen) completedToday++;
                    if (s.read) completedToday++;
                });
            }

            // Track last practiced date
            if (groupData.date) {
                lastPracticedDate = groupData.date;
            }
        }

        // Update Today Status
        const todayEl = card.querySelector('.today-status');
        if (todayEl) {
            const isDone = completedToday === totalExercises && totalExercises > 0;
            todayEl.textContent = isDone ? 'Done ✓' : 'Not yet';
            todayEl.classList.toggle('done', isDone);
            todayEl.classList.toggle('not-done', !isDone);
        }

        // Update Score
        const scoreEl = card.querySelector('.last-score');
        if (scoreEl) {
            if (completedToday > 0) {
                scoreEl.textContent = `${completedToday} / ${totalExercises}`;
            } else {
                scoreEl.textContent = '—';
            }
        }

        // Update Last Practiced
        const lastEl = card.querySelector('.last-practiced');
        if (lastEl) {
            lastEl.textContent = formatRelativeDate(lastPracticedDate);
        }
    });
}

// Legacy support
function updateGroupCompletionBadges(lang) {
    updateGroupCards(lang);
}

// ============================================
// Training Interface
// ============================================

let trainState = {
    lang: '',
    groupId: '',
    groupTitle: '',
    exercises: [],      // Shuffled array of {sentence, type: 'listen'|'read'}
    currentIndex: 0,
    revealed: false
};

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Build exercise pool from sentences
 * Each sentence appears twice: once as 'listen', once as 'read'
 * Then shuffle the entire pool
 */
function buildExercisePool(sentences) {
    const pool = [];
    sentences.forEach(sentence => {
        pool.push({ sentence, type: 'listen' });
        pool.push({ sentence, type: 'read' });
    });
    return shuffleArray(pool);
}

function initTrainingInterface() {
    const container = document.getElementById('train-app');
    if (!container) return;

    trainState.lang = container.dataset.language;

    // Parse groups data
    const groupsDataRaw = container.dataset.groups;
    let allGroups = [];

    if (groupsDataRaw) {
        try {
            allGroups = JSON.parse(groupsDataRaw);
        } catch (e) {
            console.error('Failed to parse groups data:', e);
        }
    }

    // Get group from URL query param
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('group');

    if (!groupId) {
        showNoGroup();
        return;
    }

    // Find the group
    const group = allGroups.find(g => g.group_id === groupId);
    if (!group || !group.sentences || group.sentences.length === 0) {
        showNoGroup();
        return;
    }

    trainState.groupId = group.group_id;
    trainState.groupTitle = group.group_title;
    trainState.exercises = buildExercisePool(group.sentences);
    trainState.currentIndex = 0;

    // Initialize UI
    document.getElementById('group-title').textContent = trainState.groupTitle;
    document.getElementById('no-group').style.display = 'none';
    document.getElementById('exercise-card').style.display = 'block';
    document.getElementById('total-count').textContent = trainState.exercises.length;
    document.getElementById('group-name').textContent = trainState.groupTitle;

    // Set up event listeners
    setupEventListeners();

    // Show first exercise
    showCurrentExercise();
}

function showNoGroup() {
    document.getElementById('no-group').style.display = 'block';
    document.getElementById('exercise-card').style.display = 'none';
    document.getElementById('completion-message').style.display = 'none';
}

function setupEventListeners() {
    // Main action button (Reveal / Play Audio)
    document.getElementById('action-btn').addEventListener('click', () => {
        revealAnswer();
    });

    // Got it button
    document.getElementById('got-it-btn').addEventListener('click', () => {
        recordAndAdvance(true);
    });

    // Missed it button
    document.getElementById('missed-btn').addEventListener('click', () => {
        recordAndAdvance(false);
    });
}

function showCurrentExercise() {
    const exercise = trainState.exercises[trainState.currentIndex];
    if (!exercise) return;

    const { sentence, type } = exercise;
    trainState.revealed = false;

    // Update progress
    document.getElementById('current-index').textContent = trainState.currentIndex + 1;

    // Reset visibility
    document.getElementById('reveal-area').style.display = 'none';
    document.getElementById('report-buttons').style.display = 'none';
    document.getElementById('action-btn').style.display = 'block';

    const promptArea = document.getElementById('prompt-area');
    const revealArea = document.getElementById('reveal-area');
    const audioContainer = document.getElementById('audio-container');
    const audio = document.getElementById('audio-player');
    const exerciseType = document.getElementById('exercise-type');
    const actionBtn = document.getElementById('action-btn');

    audio.src = sentence.audio;

    if (type === 'listen') {
        // Listen mode: show audio first, hide text
        exerciseType.textContent = 'Listen & Translate';
        exerciseType.className = 'exercise-type listen';
        promptArea.innerHTML = '<p class="instruction">Listen to the audio, then translate in your head.</p>';
        audioContainer.style.display = 'block';
        revealArea.innerHTML = `
            <p class="native-text">${sentence.native}</p>
            <p class="english-text">${sentence.english}</p>
        `;
        actionBtn.textContent = 'Show Answer';
    } else {
        // Read mode: show native text, hide audio
        exerciseType.textContent = 'Read & Speak';
        exerciseType.className = 'exercise-type read';
        promptArea.innerHTML = `<p class="native-text large">${sentence.native}</p>
            <p class="instruction">Read aloud, then check your pronunciation.</p>`;
        audioContainer.style.display = 'none';
        revealArea.innerHTML = `
            <div class="audio-reveal">
                <p class="english-text">${sentence.english}</p>
            </div>
        `;
        actionBtn.textContent = 'Check';
    }
}

function revealAnswer() {
    const exercise = trainState.exercises[trainState.currentIndex];
    const { type } = exercise;

    trainState.revealed = true;

    // Show reveal area
    document.getElementById('reveal-area').style.display = 'block';

    // Hide action button, show report buttons
    document.getElementById('action-btn').style.display = 'none';
    document.getElementById('report-buttons').style.display = 'flex';

    // For read mode, show and play audio
    if (type === 'read') {
        document.getElementById('audio-container').style.display = 'block';
        document.getElementById('audio-player').play();
    }
}

function recordAndAdvance(gotIt) {
    const exercise = trainState.exercises[trainState.currentIndex];
    const { sentence, type } = exercise;

    // Record completion (only if got it)
    if (gotIt) {
        markExerciseComplete(trainState.lang, trainState.groupId, sentence.id, type);
    }

    // Advance to next
    trainState.currentIndex++;

    if (trainState.currentIndex >= trainState.exercises.length) {
        showCompletion();
    } else {
        showCurrentExercise();
    }
}

function showCompletion() {
    document.getElementById('exercise-card').style.display = 'none';
    document.getElementById('completion-message').style.display = 'block';
}
