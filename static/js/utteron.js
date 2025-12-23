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
    // Use local date, not UTC, to avoid timezone issues
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    const timestamp = new Date().toISOString(); // Add timestamp

    // Initialize structure
    if (!completions[lang]) completions[lang] = {};
    if (!completions[lang][groupId]) {
        completions[lang][groupId] = {
            date: today,
            timestamp: timestamp,
            sentences: {},
            completionDates: [],
            completionHistory: {}
        };
    }

    // ALWAYS update date AND timestamp when practicing
    completions[lang][groupId].date = today;
    completions[lang][groupId].timestamp = timestamp;

    // Initialize sentence
    if (!completions[lang][groupId].sentences[sentenceId]) {
        completions[lang][groupId].sentences[sentenceId] = { listen: false, read: false };
    }

    // Mark complete
    completions[lang][groupId].sentences[sentenceId][exerciseType] = true;

    saveCompletions(completions);
}

// Call this when a training session completes with 100%
function recordGroupCompletion(lang, groupId) {
    const completions = getCompletions();
    const today = getTodayDate();

    if (!completions[lang] || !completions[lang][groupId]) return;

    // Initialize completionHistory if needed
    if (!completions[lang][groupId].completionHistory) {
        completions[lang][groupId].completionHistory = {};
    }

    // ALWAYS increment count for today (allows multiple completions per day)
    if (!completions[lang][groupId].completionHistory[today]) {
        completions[lang][groupId].completionHistory[today] = 0;
    }
    completions[lang][groupId].completionHistory[today]++;

    // Also maintain completionDates (add only once per day for streak)
    if (!completions[lang][groupId].completionDates) {
        completions[lang][groupId].completionDates = [];
    }
    if (!completions[lang][groupId].completionDates.includes(today)) {
        completions[lang][groupId].completionDates.push(today);
    }

    saveCompletions(completions);
}

function calculateGroupStreak(lang, groupId) {
    const completions = getCompletions();
    const today = getTodayDate();

    if (!completions[lang] || !completions[lang][groupId]) return 0;

    const groupData = completions[lang][groupId];

    // Get completion history
    const completionDates = groupData.completionDates || [];

    // Sort dates descending
    const sortedDates = [...completionDates].sort((a, b) => b.localeCompare(a));

    // Calculate streak from today backwards
    let streak = 0;
    let checkDate = new Date();

    for (let i = 0; i < 365; i++) {
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        const day = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (sortedDates.includes(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
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
    const cardsArray = Array.from(document.querySelectorAll('.group-card'));
    const completions = getCompletions();
    const today = getTodayDate();

    // Build array of cards with their practice dates for sorting
    const cardsWithDates = cardsArray.map(card => {
        const groupId = card.dataset.groupId;
        const groupData = completions[lang]?.[groupId];
        // Use timestamp for precise ordering, fallback to date
        const sortKey = groupData?.timestamp || groupData?.date || '0000-00-00T00:00:00';

        return {
            card: card,
            groupId: groupId,
            sortKey: sortKey
        };
    });

    // Sort by practice date (most recent first)
    cardsWithDates.sort((a, b) => {
        // Most recent first
        return b.sortKey.localeCompare(a.sortKey);
    });

    // Reorder cards in DOM
    const container = document.getElementById('group-list');
    if (container && cardsWithDates.length > 0) {
        cardsWithDates.forEach(item => {
            container.appendChild(item.card);
        });
    }

    // Now update each card's display
    cardsArray.forEach(card => {
        const groupId = card.dataset.groupId;
        const sentenceCount = parseInt(card.dataset.sentenceCount) || 0;
        const totalExercises = sentenceCount * 2;

        // Get completion data for this group
        const groupData = completions[lang]?.[groupId];

        // Calculate score and today status
        let completedToday = 0;  // Only exercises from today
        let totalCompleted = 0;  // All time (for score display)
        let lastPracticedDate = null;

        if (groupData && groupData.sentences) {
            // Track last practiced date from the group data
            if (groupData.date) {
                lastPracticedDate = groupData.date;
            }

            const isToday = groupData.date === today;

            // Count completed exercises
            Object.values(groupData.sentences).forEach(s => {
                // Count all-time completions for score
                if (s.listen) totalCompleted++;
                if (s.read) totalCompleted++;

                // Count today's completions separately
                if (isToday) {
                    if (s.listen) completedToday++;
                    if (s.read) completedToday++;
                }
            });
        }


        // Update Streak - show consecutive days group was 100% completed
        const streakEl = card.querySelector('.group-streak');
        if (streakEl) {
            const streak = calculateGroupStreak(lang, groupId);
            if (streak > 0) {
                streakEl.textContent = `${streak} day${streak !== 1 ? 's' : ''}`;
                streakEl.classList.add('has-streak');
            } else {
                streakEl.textContent = '—';
                streakEl.classList.remove('has-streak');
            }
        }

        // Update Score - shows all-time progress
        const scoreEl = card.querySelector('.last-score');
        if (scoreEl) {
            if (totalCompleted > 0) {
                const is100Percent = totalCompleted === totalExercises && totalExercises > 0;
                scoreEl.textContent = `${totalCompleted} / ${totalExercises}`;
                // Highlight green if 100%
                scoreEl.classList.toggle('perfect-score', is100Percent);
            } else {
                scoreEl.textContent = '—';
                scoreEl.classList.remove('perfect-score');
            }
        }

        // Update Last Practiced
        const lastEl = card.querySelector('.last-practiced');
        if (lastEl) {
            const formattedDate = formatRelativeDate(lastPracticedDate);
            lastEl.textContent = formattedDate;
            // Highlight green if practiced today
            lastEl.classList.toggle('practiced-today', formattedDate === 'Today');
        }

        // Update Total - sum of all 100% completions
        const totalEl = card.querySelector('.group-total');
        if (totalEl && groupData && groupData.completionHistory) {
            const totalCompletions = Object.values(groupData.completionHistory).reduce((sum, count) => sum + count, 0);
            totalEl.textContent = totalCompletions;
        } else if (totalEl) {
            totalEl.textContent = '0';
        }
    });

    // Update main stats dashboard if present
    updateLanguageStats(lang);
}

function updateLanguageStats(lang) {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const completions = getCompletions();
    const today = getTodayDate();

    // 1. Calculate Streak
    // Logic: consecutive days with at least one group completed 100%
    // We need to store streak history. For now, let's infer from available data or add a new storage structure.
    // Since we only have 'date' in the current structure, we can't look back easily without a history log.
    // Let's add a 'stats' object to the root of completions[lang].

    let stats = completions[lang]?.stats || { streak: 0, lastStreakDate: null, completedGroups: [] };

    // Check if we need to increment streak for today
    // This logic needs to run when a group is completed, not just on view.
    // But for display, we just show what's stored.

    document.getElementById('stat-streak').textContent = `${stats.streak} days`;

    // 2. Completed Groups (Lifetime)
    const completedCount = stats.completedGroups ? stats.completedGroups.length : 0;
    document.getElementById('stat-completed').textContent = completedCount;

    // 3. Today's Progress
    // Count groups completed today
    let groupsToday = 0;
    let totalGroups = 0;

    if (completions[lang]) {
        Object.keys(completions[lang]).forEach(key => {
            if (key === 'stats') return; // Skip stats object

            const group = completions[lang][key];
            if (group.date === today) {
                // Check if fully complete
                const sentences = Object.values(group.sentences);
                if (sentences.length > 0) {
                    const allDone = sentences.every(s => s.listen && s.read);
                    if (allDone) groupsToday++;
                }
            }
        });
    }

    // Get total groups from DOM
    const cards = document.querySelectorAll('.group-card');
    totalGroups = cards.length;

    document.getElementById('stat-today').textContent = `${groupsToday} / ${totalGroups} groups`;
}

function checkAndUpdateStats(lang, groupId) {
    const completions = getCompletions();
    const today = getTodayDate();

    if (!completions[lang]) completions[lang] = {};
    if (!completions[lang].stats) {
        completions[lang].stats = { streak: 0, lastStreakDate: null, completedGroups: [] };
    }

    const stats = completions[lang].stats;
    const groupData = completions[lang][groupId];

    // Check if group is fully complete
    let isGroupDone = false;
    if (groupData && groupData.sentences) {
        const sentences = Object.values(groupData.sentences);
        // We need to know total sentences for this group. 
        // Ideally passed in, but we can assume if all *tracked* sentences are done, it's done?
        // Better: we only mark complete if we just finished the last one.
        // Let's rely on the caller or check against dataset if possible.
        // For now, let's assume if all recorded sentences have both flags, it's done.
        // NOTE: This might be buggy if not all sentences are touched yet.
        // Correct fix: We need to know the total sentence count.
        // Let's pass it or look it up.
        // Actually, `markExerciseComplete` is called one by one.
        // We can check if *all* sentences in the group (from DOM or data) are done.
        // But `markExerciseComplete` doesn't have access to the full group data easily without DOM.
        // Let's do a best effort: if the group is marked "Done" in the UI, it counts.
        // But this runs in background.

        // Alternative: Just check if the current sentence made it complete?
        // Let's keep it simple: Update stats on `updateGroupCards` which runs on load.
        // But we need to update *storage* when completing an exercise.
    }
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
    trainState.groupDescription = group.description || '';
    trainState.exercises = buildExercisePool(group.sentences);
    trainState.currentIndex = 0;

    // Initialize UI
    document.getElementById('group-title').textContent = trainState.groupTitle;
    const subtitleEl = document.getElementById('group-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = trainState.groupDescription;
        subtitleEl.style.display = trainState.groupDescription ? 'block' : 'none';
    }
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

    // Replay audio button
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            const audio = document.getElementById('audio-player');
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Play failed:', e));
        });
    }
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
    const replayBtn = document.getElementById('replay-btn');

    audio.src = sentence.audio;

    if (type === 'listen') {
        // Listen mode: show audio first, hide text
        exerciseType.textContent = 'Listen & Translate';
        exerciseType.className = 'exercise-type listen';
        promptArea.innerHTML = '<p class="instruction">Listen to the audio, spell the word, then translate in your head.</p>';
        audioContainer.style.display = 'block';
        if (replayBtn) replayBtn.querySelector('span').textContent = 'Play Again';
        revealArea.innerHTML = `
            <p class="native-text">${sentence.native}</p>
            <p class="english-text">${sentence.english}</p>
        `;
        actionBtn.textContent = 'Show Answer';

        // Autoplay the audio
        audio.play().catch(e => console.log('Autoplay blocked:', e));
    } else {
        // Read mode: show native text, hide audio
        exerciseType.textContent = 'Read & Speak';
        exerciseType.className = 'exercise-type read';
        promptArea.innerHTML = `<p class="native-text large">${sentence.native}</p>
            <p class="instruction">Read aloud, then translate in your head.</p>`;
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
        // Check if this completed the group and update stats
        checkAndUpdateStats(trainState.lang, trainState.groupId, trainState.exercises);
    }

    // Advance to next
    trainState.currentIndex++;

    if (trainState.currentIndex >= trainState.exercises.length) {
        // Check if session ended with 100% and record it
        const completions = getCompletions();
        const groupData = completions[trainState.lang]?.[trainState.groupId];
        if (groupData && groupData.sentences) {
            const uniqueSentenceIds = [...new Set(trainState.exercises.map(e => e.sentence.id))];
            const allComplete = uniqueSentenceIds.every(id => {
                const s = groupData.sentences[id];
                return s && s.listen && s.read;
            });
            if (allComplete) {
                recordGroupCompletion(trainState.lang, trainState.groupId);
            }
        }
        showCompletion();
    } else {
        showCurrentExercise();
    }
}

function checkAndUpdateStats(lang, groupId, exercises) {
    if (!exercises || exercises.length === 0) return;

    const completions = getCompletions();
    const today = getTodayDate();

    // Ensure stats object exists
    if (!completions[lang]) completions[lang] = {};
    if (!completions[lang].stats) {
        completions[lang].stats = { streak: 0, lastStreakDate: null, completedGroups: [] };
    }

    const groupData = completions[lang][groupId];
    if (!groupData || !groupData.sentences) return;

    // Check if ALL sentences in the group are complete (both listen and read)
    const uniqueSentenceIds = [...new Set(exercises.map(e => e.sentence.id))];
    const allComplete = uniqueSentenceIds.every(id => {
        const s = groupData.sentences[id];
        return s && s.listen && s.read;
    });

    if (allComplete) {
        const stats = completions[lang].stats;

        // 1. Update Completed Groups (Lifetime)
        if (!stats.completedGroups.includes(groupId)) {
            stats.completedGroups.push(groupId);
        }

        // 2. Update Streak
        if (stats.lastStreakDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (stats.lastStreakDate === yesterdayStr) {
                stats.streak++;
            } else if (stats.lastStreakDate === null) {
                stats.streak = 1;
            } else {
                stats.streak = 1;
            }
            stats.lastStreakDate = today;
        }

        saveCompletions(completions);
    }
}

function showCompletion() {
    document.getElementById('exercise-card').style.display = 'none';
    document.getElementById('completion-message').style.display = 'block';
}
