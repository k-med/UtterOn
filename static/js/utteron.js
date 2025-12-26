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

            // Count completed exercises - just count what's saved
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
            // Always show score, even if 0
            const is100Percent = totalCompleted === totalExercises && totalExercises > 0;
            scoreEl.textContent = `${totalCompleted} / ${totalExercises}`;
            // Highlight green if 100%
            scoreEl.classList.toggle('perfect-score', is100Percent);
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

        // Update Start/Resume button
        const startBtn = card.querySelector('.start-btn');
        if (startBtn) {
            const stateKey = `utteron_state_${groupId}`;
            if (localStorage.getItem(stateKey)) {
                startBtn.textContent = 'Resume';
                startBtn.classList.add('resume-mode');
            } else {
                startBtn.textContent = 'Start';
                startBtn.classList.remove('resume-mode');
            }
        }
    });

    // Update main stats dashboard if present
    updateLanguageStats(lang);
    updateFundamentalsButtons(lang);
}

function updateLanguageStats(lang) {
    // Check if stats elements exist
    const streakEl = document.getElementById('stat-streak');
    if (!streakEl) return;

    const completions = getCompletions();
    const today = getTodayDate();

    // Get multipliers from localStorage or use defaults
    // Get multipliers from localStorage or use defaults
    const storedMultipliers = JSON.parse(localStorage.getItem('stat_multipliers')) || {};
    const multipliers = {
        today: storedMultipliers.today || 3,
        week: storedMultipliers.week || 7,
        month: storedMultipliers.month || 4,
        year: storedMultipliers.year || 12
    };

    // Calculate targets based on cascading multipliers
    const DAILY_TARGET = multipliers.today;
    const WEEKLY_TARGET = multipliers.today * multipliers.week;
    const MONTHLY_TARGET = multipliers.today * multipliers.week * multipliers.month;
    const YEARLY_TARGET = multipliers.today * multipliers.week * multipliers.month * multipliers.year;

    // Initialize stats if needed
    if (!completions[lang]) {
        completions[lang] = {};
    }
    if (!completions[lang].stats) {
        completions[lang].stats = { streak: 0, lastStreakDate: null, completedGroups: [] };
    }

    const stats = completions[lang].stats;

    // 1. Streak - consecutive daily quota days met
    if (streakEl) {
        streakEl.textContent = stats.streak > 0 ? `${stats.streak} Day${stats.streak !== 1 ? 's' : ''}` : '0 Days';
    }

    // Initialize counters
    let groupsCompletedToday = 0;
    let groupsCompletedThisWeek = 0;
    let groupsCompletedThisMonth = 0;
    let groupsCompletedThisYear = 0;
    let totalPerfectPasses = 0;

    // Calculate date ranges
    const todayDate = new Date(today);

    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const monthStart = new Date(todayDate);
    monthStart.setDate(monthStart.getDate() - 30);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const yearStart = new Date(todayDate);
    yearStart.setDate(yearStart.getDate() - 365);
    const yearStartStr = yearStart.toISOString().split('T')[0];

    if (completions[lang]) {
        Object.keys(completions[lang]).forEach(key => {
            if (key === 'stats') return;

            const group = completions[lang][key];

            // Use completionHistory for accurate counts
            if (group.completionHistory) {
                Object.entries(group.completionHistory).forEach(([date, count]) => {
                    // Today
                    if (date === today) {
                        groupsCompletedToday += count;
                    }
                    // Week (last 7 days)
                    if (date >= weekStartStr) {
                        groupsCompletedThisWeek += count;
                    }
                    // Month (last 30 days)
                    if (date >= monthStartStr) {
                        groupsCompletedThisMonth += count;
                    }
                    // Year (last 365 days)
                    if (date >= yearStartStr) {
                        groupsCompletedThisYear += count;
                    }
                    // All time
                    totalPerfectPasses += count;
                });
            }
        });
    }

    // 2. Today - x/target
    const todayEl = document.getElementById('stat-today');
    if (todayEl) {
        todayEl.textContent = `${groupsCompletedToday}/${DAILY_TARGET}`;
        todayEl.classList.toggle('target-met', groupsCompletedToday >= DAILY_TARGET);
    }

    // 3. Week - x/target
    const weekEl = document.getElementById('stat-week');
    if (weekEl) {
        weekEl.textContent = `${groupsCompletedThisWeek}/${WEEKLY_TARGET}`;
        weekEl.classList.toggle('target-met', groupsCompletedThisWeek >= WEEKLY_TARGET);
    }

    // 4. Month - x/target
    const monthEl = document.getElementById('stat-month');
    if (monthEl) {
        monthEl.textContent = `${groupsCompletedThisMonth}/${MONTHLY_TARGET}`;
        monthEl.classList.toggle('target-met', groupsCompletedThisMonth >= MONTHLY_TARGET);
    }

    // 5. Year - x/target
    const yearEl = document.getElementById('stat-year');
    if (yearEl) {
        yearEl.textContent = `${groupsCompletedThisYear}/${YEARLY_TARGET}`;
        yearEl.classList.toggle('target-met', groupsCompletedThisYear >= YEARLY_TARGET);
    }

    // 5. All - total 100% passes (all time)
    const allEl = document.getElementById('stat-all');
    if (allEl) {
        allEl.textContent = totalPerfectPasses;
    }
}

// Initialize stat arrow controls
function initStatArrows() {
    const storedMultipliers = JSON.parse(localStorage.getItem('stat_multipliers')) || {};
    const multipliers = {
        today: storedMultipliers.today || 3,
        week: storedMultipliers.week || 7,
        month: storedMultipliers.month || 4,
        year: storedMultipliers.year || 12
    };

    document.querySelectorAll('.stat-adjustable').forEach(col => {
        const stat = col.dataset.stat;
        const upBtn = col.querySelector('.stat-arrow.up');     // Left arrow = decrease
        const downBtn = col.querySelector('.stat-arrow.down'); // Right arrow = increase

        if (upBtn) {
            upBtn.addEventListener('click', () => {
                multipliers[stat] = Math.max(1, multipliers[stat] - 1);
                localStorage.setItem('stat_multipliers', JSON.stringify(multipliers));
                const lang = document.getElementById('group-list')?.dataset?.language;
                if (lang) updateLanguageStats(lang);
            });
        }

        if (downBtn) {
            downBtn.addEventListener('click', () => {
                multipliers[stat] = Math.min(99, multipliers[stat] + 1);
                localStorage.setItem('stat_multipliers', JSON.stringify(multipliers));
                const lang = document.getElementById('group-list')?.dataset?.language;
                if (lang) updateLanguageStats(lang);
            });
        }
    });
}

// Play native name audio
function playNativeName(langCode) {
    if (!langCode) return;
    const audioFiles = { 'czech': '/assets/audio/czech/cz_001.mp3' };
    const audioPath = audioFiles[langCode];

    if (audioPath) {
        const audio = new Audio(audioPath);
        audio.play().catch(e => console.log('Audio play failed:', e));
    } else {
        const langMap = { 'czech': 'cs-CZ' };
        const utterance = new SpeechSynthesisUtterance(langCode);
        utterance.lang = langMap[langCode] || 'en-US';
        window.speechSynthesis.speak(utterance);
    }
}

// Update fundamentals buttons
function updateFundamentalsButtons(lang) {
    const fundamentalBtns = document.querySelectorAll('.fundamental-btn');
    if (!fundamentalBtns.length) return;

    const completions = getCompletions();
    const today = getTodayDate();

    fundamentalBtns.forEach(btn => {
        const groupId = btn.dataset.groupId;
        const sentenceCount = parseInt(btn.dataset.sentenceCount) || 0;
        const scoreBadgeEl = btn.querySelector('.fundamental-score');
        const itemCountEl = btn.querySelector('.fundamental-item-count');

        if (!scoreBadgeEl) return;

        // Update item count badge (static)
        if (itemCountEl) {
            itemCountEl.textContent = `${sentenceCount}`;
        }

        const totalScore = sentenceCount * 2; // 1 for listen, 1 for read/speak

        if (!completions[lang] || !completions[lang][groupId]) {
            scoreBadgeEl.textContent = `0/${totalScore}`;
            btn.classList.remove('complete-today');
            return;
        }

        const group = completions[lang][groupId];
        let currentScore = 0;

        // Simply count what's saved
        if (group.sentences) {
            Object.values(group.sentences).forEach(s => {
                if (s.listen) currentScore++;
                if (s.read) currentScore++;
            });
        }

        scoreBadgeEl.textContent = `${currentScore}/${totalScore}`;

        // Only highlight green if 100% complete (no orange for partial progress)
        const is100Percent = currentScore === totalScore && totalScore > 0;
        const practicedToday = group.date === today;

        if (is100Percent && practicedToday) {
            btn.classList.add('complete-today');
        } else {
            btn.classList.remove('complete-today');
        }
    });
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

// Session statistics tracking
let sessionStats = {
    total: 0,
    correct: 0,
    missed: 0
};

function resetSessionStats() {
    sessionStats = { total: 0, correct: 0, missed: 0 };
}

function updateProgressBar() {
    const progressFill = document.getElementById('progress-bar');

    if (progressFill && trainState.exercises.length > 0) {
        const percentage = ((trainState.currentIndex + 1) / trainState.exercises.length) * 100;
        progressFill.style.width = `${percentage}%`;
    }
}

function getPerformanceMessage(accuracy) {
    if (accuracy === 100) {
        return "🌟 Perfect score! You've mastered this group!";
    } else if (accuracy >= 90) {
        return "🎯 Excellent work! You're almost there!";
    } else if (accuracy >= 75) {
        return "👍 Great job! Keep practicing to perfect it!";
    } else if (accuracy >= 60) {
        return "💪 Good effort! Review the tricky ones and try again!";
    } else {
        return "📚 Keep going! Practice makes perfect!";
    }
}

function displayCompletionStats() {
    const accuracy = sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;

    // Update text values
    document.getElementById('total-questions').textContent = sessionStats.total;
    document.getElementById('correct-count').textContent = sessionStats.correct;
    document.getElementById('missed-count').textContent = sessionStats.missed;
    document.getElementById('accuracy-text').textContent = `${accuracy}%`;
    document.getElementById('accuracy-value').textContent = `${accuracy}%`;

    // Animate circular progress
    const circle = document.getElementById('accuracy-progress');
    if (circle) {
        const circumference = 283; // 2 * π * 45
        const offset = circumference - (accuracy / 100) * circumference;
        setTimeout(() => {
            circle.style.strokeDashoffset = offset;
        }, 300);
    }

    // Set performance message
    const messageEl = document.getElementById('performance-message');
    if (messageEl) {
        messageEl.textContent = getPerformanceMessage(accuracy);
    }

    // Update icon and title based on performance
    const icon = document.getElementById('completion-icon');
    const title = document.getElementById('completion-title');
    const subtitle = document.getElementById('completion-subtitle');

    if (accuracy === 100) {
        icon.textContent = '🏆';
        title.textContent = 'Perfect Score!';
        subtitle.textContent = 'You\'ve mastered this group!';
    } else if (accuracy >= 80) {
        icon.textContent = '🎉';
        title.textContent = 'Great Job!';
        subtitle.textContent = 'Excellent work on this session!';
    } else {
        icon.textContent = '✅';
        title.textContent = 'Session Complete!';
        subtitle.textContent = 'Keep practicing to improve!';
    }
}

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

    // Check for saved state
    const stateKey = `utteron_state_${trainState.groupId}`;
    const savedStateRaw = localStorage.getItem(stateKey);
    let loadedFromSave = false;

    if (savedStateRaw) {
        try {
            const savedState = JSON.parse(savedStateRaw);
            // Basic validation: check if exercises exist
            if (savedState.exercises && savedState.exercises.length > 0) {
                trainState.exercises = savedState.exercises;
                trainState.currentIndex = savedState.currentIndex || 0;
                loadedFromSave = true;
                console.log('Resuming session for group:', trainState.groupId);
            }
        } catch (e) {
            console.error('Failed to load saved state:', e);
        }
    }

    if (!loadedFromSave) {
        trainState.exercises = buildExercisePool(group.sentences);
        trainState.currentIndex = 0;
        resetSessionStats(); // Reset stats for new session
    }

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

    // Set up event listeners
    setupEventListeners();

    // Initialize progress bar
    updateProgressBar();

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

    // Retry button (on completion screen)
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            // Get unique sentences from exercises
            const uniqueSentences = [];
            const seenIds = new Set();
            trainState.exercises.forEach(ex => {
                if (!seenIds.has(ex.sentence.id)) {
                    uniqueSentences.push(ex.sentence);
                    seenIds.add(ex.sentence.id);
                }
            });

            // Reset and restart session
            resetSessionStats();
            trainState.exercises = buildExercisePool(uniqueSentences);
            trainState.currentIndex = 0;

            // Hide completion, show exercise card
            document.getElementById('completion-message').style.display = 'none';
            document.getElementById('exercise-card').style.display = 'block';

            // Reset progress bar and show first exercise
            updateProgressBar();
            showCurrentExercise();
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

        // Show gender hint if available
        const genderHint = sentence.gender ? `<span class="gender-hint">${sentence.gender}</span>` : '';
        promptArea.innerHTML = `${genderHint}<p class="instruction">Listen to the audio, spell the word, then translate in your head.</p>`;

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

    // Track session stats
    sessionStats.total++;
    if (gotIt) {
        sessionStats.correct++;
        markExerciseComplete(trainState.lang, trainState.groupId, sentence.id, type);
        // Check if this completed the group and update stats
        checkAndUpdateStats(trainState.lang, trainState.groupId, trainState.exercises);
    } else {
        sessionStats.missed++;
    }

    // Advance to next
    trainState.currentIndex++;

    // Update progress bar
    updateProgressBar();

    // Save state
    const stateKey = `utteron_state_${trainState.groupId}`;
    if (trainState.currentIndex < trainState.exercises.length) {
        localStorage.setItem(stateKey, JSON.stringify({
            exercises: trainState.exercises,
            currentIndex: trainState.currentIndex,
            timestamp: new Date().toISOString()
        }));
        showCurrentExercise();
    } else {
        // Clear state if finished
        localStorage.removeItem(stateKey);

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

        // Display completion stats before showing completion screen
        displayCompletionStats();
        showCompletion();
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

// ============================================
// Foundations Section Toggle
// ============================================

function toggleFoundations() {
    console.log('toggleFoundations called');
    const section = document.getElementById('foundations-section');
    if (!section) {
        console.error('Foundations section not found');
        return;
    }

    section.classList.toggle('minimized');
    const minimized = section.classList.contains('minimized');
    console.log('Toggled minimized:', minimized);
    localStorage.setItem('utteron_foundations_minimized', minimized);
}

// Initialize state on load
function initFoundationsState() {
    console.log('Initializing Foundations state');
    const section = document.getElementById('foundations-section');
    if (!section) return;

    const isMinimized = localStorage.getItem('utteron_foundations_minimized') === 'true';
    if (isMinimized) {
        section.classList.add('minimized');
    }
}

// Make sure functions are available globally
window.toggleFoundations = toggleFoundations;
window.initFoundationsState = initFoundationsState;

// ============================================
// Group Card Toggle Functions
// ============================================

// Toggle individual group card
function toggleGroupCard(groupId) {
    const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
    if (!card) return;

    card.classList.toggle('minimized');

    // Save state to localStorage
    const minimizedCards = JSON.parse(localStorage.getItem('utteron_minimized_cards') || '{}');
    minimizedCards[groupId] = card.classList.contains('minimized');
    localStorage.setItem('utteron_minimized_cards', JSON.stringify(minimizedCards));

    // Update master toggle state
    updateMasterToggleState();
}

// Toggle all cards (master toggle)
function toggleAllCards() {
    const header = document.querySelector('.modules-header');
    const cards = document.querySelectorAll('.group-card');

    if (!header || !cards.length) return;

    const isCollapsed = header.classList.contains('collapsed');

    if (isCollapsed) {
        // Expand all
        header.classList.remove('collapsed');
        cards.forEach(card => card.classList.remove('minimized'));
        localStorage.setItem('utteron_all_cards_collapsed', 'false');
        localStorage.setItem('utteron_minimized_cards', '{}');
    } else {
        // Collapse all (minimize each card, not hide)
        header.classList.add('collapsed');
        cards.forEach(card => card.classList.add('minimized'));
        localStorage.setItem('utteron_all_cards_collapsed', 'true');
    }
}

// Update master toggle based on individual card states
function updateMasterToggleState() {
    const header = document.querySelector('.modules-header');
    const cards = document.querySelectorAll('.group-card');
    if (!header || !cards.length) return;

    const allMinimized = Array.from(cards).every(card => card.classList.contains('minimized'));
    if (allMinimized) {
        header.classList.add('collapsed');
    } else {
        header.classList.remove('collapsed');
    }
}

// Initialize group card states on load
function initGroupCardState() {
    const header = document.querySelector('.modules-header');
    const cards = document.querySelectorAll('.group-card');

    // Check if all collapsed
    const allCollapsed = localStorage.getItem('utteron_all_cards_collapsed') === 'true';
    if (allCollapsed && header && cards.length) {
        header.classList.add('collapsed');
        cards.forEach(card => card.classList.add('minimized'));
        return;
    }

    // Restore individual card states
    const minimizedCards = JSON.parse(localStorage.getItem('utteron_minimized_cards') || '{}');
    Object.entries(minimizedCards).forEach(([groupId, isMinimized]) => {
        if (isMinimized) {
            const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
            if (card) card.classList.add('minimized');
        }
    });

    updateMasterToggleState();
}

// Make functions globally accessible
window.toggleGroupCard = toggleGroupCard;
window.toggleAllCards = toggleAllCards;
window.initGroupCardState = initGroupCardState;
