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

// ============================================
// Module Level State (per-module CEFR level)
// ============================================

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_STORAGE_KEY = 'utteron_module_levels';

function getModuleLevels() {
    try {
        return JSON.parse(localStorage.getItem(LEVEL_STORAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveModuleLevels(data) {
    localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(data));
}

function getModuleLevel(groupId) {
    const levels = getModuleLevels();
    if (levels[groupId]) {
        return levels[groupId];
    }
    // Fallback: get default from DOM
    const selector = document.querySelector(`.level-selector[data-group-id="${groupId}"]`);
    return selector ? selector.dataset.defaultLevel : 'A1';
}

function setModuleLevel(groupId, level) {
    const levels = getModuleLevels();
    levels[groupId] = level;
    saveModuleLevels(levels);
}

function switchModuleLevel(groupId, direction) {
    const currentLevel = getModuleLevel(groupId);
    const currentIndex = LEVELS.indexOf(currentLevel);

    // Get available levels for this module
    const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
    const availableLevels = card ? (card.dataset.availableLevels || 'A1').split(',') : ['A1'];

    // Find next available level in the given direction
    let targetIndex = currentIndex + direction;
    while (targetIndex >= 0 && targetIndex < LEVELS.length) {
        if (availableLevels.includes(LEVELS[targetIndex])) {
            break;
        }
        targetIndex += direction;
    }

    // Bounds check - no available level found in direction
    if (targetIndex < 0 || targetIndex >= LEVELS.length) return;
    if (!availableLevels.includes(LEVELS[targetIndex])) return;

    const newLevel = LEVELS[targetIndex];
    setModuleLevel(groupId, newLevel);

    // Update UI
    updateModuleLevelDisplay(groupId, newLevel);
}

function updateModuleLevelDisplay(groupId, level) {
    const selector = document.querySelector(`.level-selector[data-group-id="${groupId}"]`);
    const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
    const availableLevels = card ? (card.dataset.availableLevels || 'A1').split(',').sort() : ['A1'];
    const levelIndex = LEVELS.indexOf(level);

    // Find if there's a lower/higher available level
    const hasLowerLevel = LEVELS.slice(0, levelIndex).some(l => availableLevels.includes(l));
    const hasHigherLevel = LEVELS.slice(levelIndex + 1).some(l => availableLevels.includes(l));

    // Update collapsed view level badge and chevrons
    if (selector) {
        const badge = selector.querySelector('.level-badge');
        if (badge) {
            badge.textContent = level;
            badge.dataset.level = level;
        }

        const downBtn = selector.querySelector('.level-down');
        const upBtn = selector.querySelector('.level-up');
        if (downBtn) downBtn.disabled = !hasLowerLevel;
        if (upBtn) upBtn.disabled = !hasHigherLevel;
    }

    // Update collapsed view subtitle (alt_title) based on level
    if (card) {
        const levelsDataRaw = card.dataset.levelsData;
        if (levelsDataRaw) {
            try {
                const levelsData = JSON.parse(levelsDataRaw);
                const levelData = levelsData[level];
                if (levelData?.Params?.alt_title) {
                    const subtitleEl = card.querySelector('.group-card-subtitle');
                    if (subtitleEl) {
                        subtitleEl.textContent = levelData.Params.alt_title;
                    }
                }
            } catch (e) {
                console.warn('Failed to update subtitle for level:', e);
            }
        }
    }

    // Update expanded view difficulty arrows
    const badgeContainer = document.querySelector(`.difficulty-badge-container[data-group-id="${groupId}"]`);
    if (badgeContainer) {
        const leftArrow = badgeContainer.querySelector('.difficulty-arrow-left');
        const rightArrow = badgeContainer.querySelector('.difficulty-arrow-right');
        if (leftArrow) leftArrow.disabled = !hasLowerLevel;
        if (rightArrow) rightArrow.disabled = !hasHigherLevel;
    }

    // Update time estimate based on level multiplier
    updateTimeEstimate(groupId, level);

    // Update expanded card content if visible
    updateExpandedCardLevel(groupId, level);
}

function updateTimeEstimate(groupId, level) {
    const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
    if (!card) return;

    // Get level-specific sentence count from levels data
    let sentenceCount = parseInt(card.dataset.sentenceCount) || 10;
    const levelsDataRaw = card.dataset.levelsData;
    if (levelsDataRaw) {
        try {
            const levelsData = JSON.parse(levelsDataRaw);
            const levelData = levelsData[level];
            if (levelData?.Params?.sentences) {
                sentenceCount = levelData.Params.sentences.length;
                card.dataset.sentenceCount = sentenceCount;
            }
        } catch (e) {
            console.warn('Failed to parse levels data for time estimate:', e);
        }
    }

    const baseSeconds = sentenceCount * 25;

    // CEFR multipliers
    const multipliers = { A1: 1.0, A2: 1.15, B1: 1.35, B2: 1.6, C1: 1.9, C2: 2.2 };
    const multiplier = multipliers[level] || 1.0;

    const estSeconds = Math.round(baseSeconds * multiplier);
    const minLow = Math.max(1, Math.floor(estSeconds / 60));
    const minHigh = Math.ceil(estSeconds / 60) + 1;
    const timeText = `~${minLow}-${minHigh} min`;

    // Update collapsed row time
    const timeEl = card.querySelector('.group-card-time');
    if (timeEl) {
        timeEl.textContent = timeText;
    }

    // Update expanded card stats grid time
    const statsTimeEl = card.querySelector('.stats-grid .stat-card:nth-child(2) .stat-value');
    if (statsTimeEl) {
        statsTimeEl.textContent = timeText;
    }
}

function updateExpandedCardLevel(groupId, level) {
    const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
    if (!card) return;

    // Update difficulty badge in expanded view
    const badge = card.querySelector('.group-content-wrapper .difficulty-badge');
    if (badge) {
        badge.dataset.level = level;
        const categoryEl = badge.querySelector('.difficulty-category');
        const levelEl = badge.querySelector('.difficulty-level');

        if (categoryEl) {
            if (level === 'A1' || level === 'A2') categoryEl.textContent = 'Beginner';
            else if (level === 'B1' || level === 'B2') categoryEl.textContent = 'Intermediate';
            else categoryEl.textContent = 'Advanced';
        }
        if (levelEl) levelEl.textContent = level;
    }

    // Get level-specific data from card
    const levelsDataRaw = card.dataset.levelsData;
    if (!levelsDataRaw) return;

    try {
        const levelsData = JSON.parse(levelsDataRaw);
        const levelData = levelsData[level];

        if (levelData && levelData.Params) {
            const params = levelData.Params;

            // Update description - parse first line as secondary title, rest as description
            if (params.description) {
                const lines = params.description.split('\n').filter(l => l.trim());
                const secondaryTitle = lines[0] || '';
                const descText = lines.slice(1).join(' ').trim() || '';

                const secondaryTitleEl = card.querySelector('.secondary-title');
                if (secondaryTitleEl) secondaryTitleEl.textContent = secondaryTitle;

                const descTextEl = card.querySelector('.description-text');
                if (descTextEl) descTextEl.textContent = descText;
            }

            // Update sentence count in stats grid (first stat card)
            const sentenceCountEl = card.querySelector('.stats-grid .stat-card:first-child .stat-value');
            if (sentenceCountEl && params.sentences) {
                sentenceCountEl.textContent = params.sentences.length;
                card.dataset.sentenceCount = params.sentences.length;
            }

            // Update sentences data attribute for training
            if (params.sentences) {
                card.dataset.sentences = JSON.stringify(params.sentences);
            }

            // Update sentence previews (first 3)
            const previewsContainer = card.querySelector('.sentence-previews');
            if (previewsContainer && params.sentences) {
                const sentences = params.sentences.slice(0, 3);
                previewsContainer.innerHTML = sentences.map(s => `
                    <div class="sentence-preview">
                        <span class="preview-native">${s.native}</span>
                        <span class="preview-english">${s.english}</span>
                    </div>
                `).join('');
            }

            // Update progress display with level-specific progress
            const lang = document.getElementById('group-list')?.dataset?.language;
            if (lang) {
                updateLevelSpecificProgress(card, lang, groupId, level, params.sentences?.length || 0);

                // CRITICAL: Update ALL card stats including Streak, Last Practiced, Resume button
                updateCardStats(card, groupId, level);
            }
        }
    } catch (e) {
        console.warn('Failed to parse levels data:', e);
    }
}

/**
 * Update progress display using level-specific storage key
 */
function updateLevelSpecificProgress(card, lang, groupId, level, sentenceCount) {
    const completions = getCompletions();
    const storageKey = `${groupId}_${level}`;
    const groupData = completions[lang]?.[storageKey];
    const totalExercises = sentenceCount * 2;

    // Update Progress stat in expanded card
    const scoreEl = card.querySelector('.last-score');
    if (scoreEl) {
        let sessionCompleted = 0;

        // Check saved session state
        const stateKey = `utteron_state_${groupId}_${level}`;
        const savedState = localStorage.getItem(stateKey);
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.completedExercises) {
                    sessionCompleted = state.completedExercises.length;
                } else if (state.currentIndex) {
                    sessionCompleted = state.currentIndex;
                }
            } catch (e) {
                // Fallback to completion data
            }
        }

        // Fallback: count from completions
        if (sessionCompleted === 0 && groupData?.sentences) {
            Object.values(groupData.sentences).forEach(s => {
                if (s.listen) sessionCompleted++;
                if (s.read) sessionCompleted++;
            });
        }

        const is100Percent = sessionCompleted === totalExercises && totalExercises > 0;
        scoreEl.textContent = `${sessionCompleted} / ${totalExercises}`;
        scoreEl.classList.toggle('perfect-score', is100Percent);
    }
}

function initModuleLevels() {
    // Initialize all level selectors with saved state
    document.querySelectorAll('.level-selector').forEach(selector => {
        const groupId = selector.dataset.groupId;
        const level = getModuleLevel(groupId);
        updateModuleLevelDisplay(groupId, level);
    });
}

function toggleStatsEditMode() {
    const card = document.querySelector('.language-header-card');
    if (!card) return;

    const isEditing = card.classList.toggle('is-editing');
    const editIcon = card.querySelector('.edit-stats-btn .edit-icon');
    const closeIcon = card.querySelector('.edit-stats-btn .close-icon');

    if (editIcon && closeIcon) {
        editIcon.style.display = isEditing ? 'none' : 'block';
        closeIcon.style.display = isEditing ? 'block' : 'none';
    }

    // Sync toggle checkboxes with current visibility state when entering edit mode
    if (isEditing) {
        const visibility = JSON.parse(localStorage.getItem('stat_visibility')) || {};
        document.querySelectorAll('.stat-toggleable').forEach(stat => {
            const statName = stat.dataset.stat;
            const checkbox = stat.querySelector('.stat-visibility-toggle input');
            if (checkbox) {
                checkbox.checked = visibility[statName] === true;
            }
        });
    }
}

function toggleStatVisibility(statName, isVisible) {
    const visibility = JSON.parse(localStorage.getItem('stat_visibility')) || {};
    visibility[statName] = isVisible;
    localStorage.setItem('stat_visibility', JSON.stringify(visibility));

    // Update the stat element's visibility class
    const statEl = document.querySelector(`.stat-toggleable[data-stat="${statName}"]`);
    if (statEl) {
        statEl.classList.toggle('stat-hidden', !isVisible);
    }
}

function initStatVisibility() {
    const visibility = JSON.parse(localStorage.getItem('stat_visibility')) || {};

    // Apply saved visibility (default is hidden)
    document.querySelectorAll('.stat-toggleable').forEach(stat => {
        const statName = stat.dataset.stat;
        const isVisible = visibility[statName] === true; // Default false if not set
        stat.classList.toggle('stat-hidden', !isVisible);

        // Also set checkbox state
        const checkbox = stat.querySelector('.stat-visibility-toggle input');
        if (checkbox) {
            checkbox.checked = isVisible;
        }
    });
}

// Make functions globally accessible
window.toggleStatsEditMode = toggleStatsEditMode;
window.toggleStatVisibility = toggleStatVisibility;
window.initStatVisibility = initStatVisibility;
window.switchModuleLevel = switchModuleLevel;
window.initModuleLevels = initModuleLevels;

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

function markExerciseComplete(lang, groupId, sentenceId, exerciseType, level) {
    const completions = getCompletions();
    const today = getTodayDate();
    const timestamp = new Date().toISOString();

    // Use level-specific key if level provided
    const storageKey = level ? `${groupId}_${level}` : groupId;

    // Initialize structure
    if (!completions[lang]) completions[lang] = {};
    if (!completions[lang][storageKey]) {
        completions[lang][storageKey] = {
            date: today,
            timestamp: timestamp,
            sentences: {},
            completionDates: [],
            completionHistory: {},
            level: level || 'A1'
        };
    }

    // ALWAYS update date AND timestamp when practicing
    completions[lang][storageKey].date = today;
    completions[lang][storageKey].timestamp = timestamp;
    completions[lang][storageKey].lastPracticed = timestamp; // For relative date display

    // Initialize sentence
    if (!completions[lang][storageKey].sentences[sentenceId]) {
        completions[lang][storageKey].sentences[sentenceId] = { listen: false, read: false };
    }

    // Mark complete
    completions[lang][storageKey].sentences[sentenceId][exerciseType] = true;

    saveCompletions(completions);
}

// Call this when a training session completes with 100%
function recordGroupCompletion(lang, groupId, level) {
    const completions = getCompletions();
    const today = getTodayDate();

    // Use level-specific key if level provided
    const storageKey = level ? `${groupId}_${level}` : groupId;

    if (!completions[lang] || !completions[lang][storageKey]) return;

    // Initialize completionHistory if needed
    if (!completions[lang][storageKey].completionHistory) {
        completions[lang][storageKey].completionHistory = {};
    }

    // ALWAYS increment count for today (allows multiple completions per day)
    if (!completions[lang][storageKey].completionHistory[today]) {
        completions[lang][storageKey].completionHistory[today] = 0;
    }
    completions[lang][storageKey].completionHistory[today]++;

    // Also maintain completionDates (add only once per day for streak)
    if (!completions[lang][storageKey].completionDates) {
        completions[lang][storageKey].completionDates = [];
    }
    if (!completions[lang][storageKey].completionDates.includes(today)) {
        completions[lang][storageKey].completionDates.push(today);
    }

    // Update global stats for hero dashboard
    if (!completions[lang].stats) {
        completions[lang].stats = { streak: 0, lastStreakDate: null, completedGroups: [] };
    }

    // Update streak if this is first completion today
    const stats = completions[lang].stats;
    if (stats.lastStreakDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (stats.lastStreakDate === yesterdayStr) {
            stats.streak++;
        } else if (!stats.lastStreakDate) {
            stats.streak = 1;
        } else {
            stats.streak = 1; // Reset streak if gap
        }
        stats.lastStreakDate = today;
    }

    saveCompletions(completions);

    // Update the hero stats display immediately
    updateLanguageStats(lang);

    // Update the card stats
    const card = document.querySelector(`.group-card[data-group-id='${groupId}']`);
    if (card) {
        updateCardStats(card, groupId, level);
    }
}

function calculateGroupStreak(lang, groupId) {
    const completions = getCompletions();
    const today = getTodayDate();

    if (!completions[lang] || !completions[lang][groupId]) return 0;

    const groupData = completions[lang][groupId];

    // Build completionDates from all available sources for backwards compatibility
    let completionDates = groupData.completionDates || [];

    // Also include dates from completionHistory if not already in completionDates
    if (groupData.completionHistory) {
        Object.keys(groupData.completionHistory).forEach(date => {
            if (!completionDates.includes(date)) {
                completionDates.push(date);
            }
        });
    }

    // Also include the current 'date' field if 100% complete today
    if (groupData.date && !completionDates.includes(groupData.date)) {
        // Check if 100% complete for this day
        const sentenceCount = Object.keys(groupData.sentences || {}).length;
        let completed = 0;
        Object.values(groupData.sentences || {}).forEach(s => {
            if (s.listen) completed++;
            if (s.read) completed++;
        });
        // If appears to have progress, include the date
        if (completed > 0) {
            // We can't verify 100% without knowing total, so trust it
            completionDates.push(groupData.date);
        }
    }

    // Remove duplicates and sort descending
    completionDates = [...new Set(completionDates)].sort((a, b) => b.localeCompare(a));

    // Calculate streak from today backwards
    let streak = 0;
    let checkDate = new Date();

    for (let i = 0; i < 365; i++) {
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        const day = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (completionDates.includes(dateStr)) {
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
        // Use the active level for this module
        const activeLevel = getModuleLevel(groupId);
        const storageKey = `${groupId}_${activeLevel}`;
        const groupData = completions[lang]?.[storageKey];
        // Use timestamp for precise ordering, fallback to date
        const sortKey = groupData?.timestamp || groupData?.date || '0000-00-00T00:00:00';

        return {
            card: card,
            groupId: groupId,
            storageKey: storageKey,
            level: activeLevel,
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

    // Now update each card's display using the centralized function
    console.log('[DEBUG] Running initialization loop for', cardsWithDates.length, 'cards');
    cardsWithDates.forEach(({ card, groupId, level }) => {
        // Default to A1 on initial load as per logic above
        // This ensures consistent initial state.
        updateCardStats(card, groupId, level);
    });
    // Update main stats dashboard if present
    updateLanguageStats(lang);
    updateFundamentalsButtons(lang);
}

/**
 * Update card stats (Sentences, Time, Progress, Streak, Last Practiced, Resume Button)
 * This is the SINGLE SOURCE OF TRUTH for card stat updates.
 * @param {HTMLElement} card - The group-card element
 * @param {string} groupId - The group identifier
 * @param {string} level - The CEFR level (A1, A2, etc.)
 */
function updateCardStats(card, groupId, level) {
    const lang = document.getElementById('group-list')?.dataset?.language;
    if (!lang) return;

    const completions = getCompletions();
    const storageKey = `${groupId}_${level}`;
    const data = completions[lang]?.[storageKey];

    // Update Difficulty Badges
    const visibleBadges = card.querySelectorAll('.difficulty-badge');
    visibleBadges.forEach(b => {
        if (b.dataset.level === level) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    // Update Stats (Sentences/Time) using level data
    const sentenceCountEl = card.querySelector('.stat-sentences');
    const timeEl = card.querySelector('.stat-time');
    const progressEl = card.querySelector('.stat-progress');

    // Parse levels data for sentence count and time estimate
    if (card.dataset.levelsData) {
        try {
            const levelsData = JSON.parse(card.dataset.levelsData);
            const levelParams = levelsData[level]?.Params;

            if (levelParams) {
                if (sentenceCountEl) {
                    sentenceCountEl.textContent = levelParams.sentences ? levelParams.sentences.length : 0;
                }

                // Recalculate time estimate
                if (timeEl && levelParams.sentences) {
                    const count = levelParams.sentences.length;
                    const base = count * 25;
                    const multMap = { 'A1': 100, 'A2': 115, 'B1': 135, 'B2': 160, 'C1': 190, 'C2': 220 };
                    const m = multMap[level] || 100;
                    const estSeconds = (base * m) / 100;
                    const mins = estSeconds / 60;
                    const minLow = Math.floor(mins);
                    const minHigh = minLow + 2;
                    timeEl.textContent = `~${minLow > 0 ? minLow : 1}-${minHigh} min`;
                }
            }
        } catch (e) {
            console.error('Error parsing level data:', e);
        }
    }

    // Progress Logic
    if (progressEl) {
        const sentences = sentenceCountEl ? parseInt(sentenceCountEl.textContent) || 0 : 0;
        const total = sentences * 2;
        let score = 0;

        if (data && data.sentences) {
            Object.values(data.sentences).forEach(s => {
                if (s.listen) score++;
                if (s.read) score++;
            });
        }
        progressEl.textContent = `${score} / ${total}`;

        // Green highlight for 100% completion
        const is100Percent = total > 0 && score === total;
        progressEl.classList.toggle('green-text', is100Percent);
        progressEl.classList.toggle('perfect-score', is100Percent);
    }

    // Last Practiced - Use formatRelativeDate
    const lastPracticedEl = card.querySelector('.last-practiced');
    if (lastPracticedEl) {
        lastPracticedEl.classList.remove('green-text', 'practiced-today');

        let dateToFormat = null;
        if (data && data.lastPracticed) {
            dateToFormat = data.lastPracticed;
        }

        const formatted = formatRelativeDate(dateToFormat);
        lastPracticedEl.textContent = formatted;

        if (formatted === 'Today') {
            lastPracticedEl.classList.add('green-text', 'practiced-today');
        } else if (formatted === 'Yesterday') {
            lastPracticedEl.classList.add('green-text');
        }
    }

    // Streak - Calculate using completionHistory
    const cardStreakEl = card.querySelector('.group-streak');
    if (cardStreakEl) {
        cardStreakEl.classList.remove('green-text', 'has-streak');

        const streakValue = calculateGroupStreak(lang, storageKey);

        if (streakValue > 0) {
            cardStreakEl.textContent = `${streakValue} day${streakValue > 1 ? 's' : ''}`;
            cardStreakEl.classList.add('green-text', 'has-streak');
        } else {
            cardStreakEl.textContent = '—';
        }
    }

    // Resume Button Logic
    const btn = card.querySelector('.start-btn');
    const compactBtn = card.querySelector('.start-btn-compact');

    const stateKey = `utteron_state_${groupId}_${level}`;
    const activeState = localStorage.getItem(stateKey);
    let hasActiveSession = false;

    if (activeState) {
        try {
            const s = JSON.parse(activeState);
            if (s && s.exercises && s.exercises.length > 0 && s.currentIndex > 0 && s.currentIndex < s.exercises.length) {
                hasActiveSession = true;
            }
        } catch (e) { /* ignore parse errors */ }
    }

    if (hasActiveSession) {
        if (btn) { btn.textContent = 'Resume'; btn.classList.add('resume-mode'); }
        if (compactBtn) { compactBtn.textContent = 'Resume'; compactBtn.classList.add('resume-mode'); }
    } else {
        if (btn) { btn.textContent = 'Start'; btn.classList.remove('resume-mode'); }
        if (compactBtn) { compactBtn.textContent = 'Start'; compactBtn.classList.remove('resume-mode'); }
    }
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

    // 2. Today - x of target
    const todayValEl = document.getElementById('stat-today');
    const todayTargetEl = document.getElementById('target-today');
    if (todayValEl && todayTargetEl) {
        todayValEl.textContent = groupsCompletedToday;
        todayTargetEl.textContent = DAILY_TARGET;
        todayValEl.classList.toggle('target-met', groupsCompletedToday >= DAILY_TARGET);
    }

    // 3. Week - x of target
    const weekValEl = document.getElementById('stat-week');
    const weekTargetEl = document.getElementById('target-week');
    if (weekValEl && weekTargetEl) {
        weekValEl.textContent = groupsCompletedThisWeek;
        weekTargetEl.textContent = WEEKLY_TARGET;
        weekValEl.classList.toggle('target-met', groupsCompletedThisWeek >= WEEKLY_TARGET);
    }

    // 4. Month - x of target
    const monthValEl = document.getElementById('stat-month');
    const monthTargetEl = document.getElementById('target-month');
    if (monthValEl && monthTargetEl) {
        monthValEl.textContent = groupsCompletedThisMonth;
        monthTargetEl.textContent = MONTHLY_TARGET;
        monthValEl.classList.toggle('target-met', groupsCompletedThisMonth >= MONTHLY_TARGET);
    }

    // 5. Year - x of target (Yearly target logic: today * week * month * year is technically massive, 
    // let's simplify to just tracking total passes broadly or keep using multiplier)
    const yearValEl = document.getElementById('stat-year');
    const yearTargetEl = document.getElementById('target-year');

    if (yearValEl && yearTargetEl) {
        yearValEl.textContent = totalPerfectPasses;
        yearTargetEl.textContent = YEARLY_TARGET;
    }

    // 6. All - total 100% passes (all time)
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

// Adjust stat targets
window.adjustStatTarget = function (statType, delta) {
    const multipliers = JSON.parse(localStorage.getItem('stat_multipliers')) || {
        today: 5,
        week: 7,
        month: 4,
        year: 12
    };

    // Bounds checking
    if (statType === 'today') {
        multipliers.today = Math.max(1, Math.min(99, multipliers.today + delta));
    } else if (statType === 'week') {
        multipliers.week = Math.max(1, Math.min(7, multipliers.week + delta));
    } else if (statType === 'month') {
        multipliers.month = Math.max(1, Math.min(12, multipliers.month + delta));
    } else if (statType === 'year') {
        multipliers.year = Math.max(1, Math.min(100, multipliers.year + delta));
    }

    localStorage.setItem('stat_multipliers', JSON.stringify(multipliers));
    const lang = document.getElementById('group-list')?.dataset?.language;
    if (lang) updateLanguageStats(lang);
};

// Play native name audio
function playNativeName(langCode) {
    if (!langCode) return;
    const audioFiles = {
        'czech': '/assets/audio/czech/cz_001.mp3',
        'vietnamese': '/assets/audio/vietnamese/vi_name.mp3'
    };
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
            btn.classList.remove('complete-today', 'partial-progress');
            // Ensure progress bar defaults to 0%
            const progressFill = btn.querySelector('.fundamental-progress-fill');
            if (progressFill) {
                progressFill.style.width = '0%';
                progressFill.style.backgroundColor = ''; // Revert to default
            }
            // Progress Logic
            // This block seems to be a duplicate or alternative to the existing progress bar logic.
            // Assuming it's intended to be part of a different update function or a refactor.
            // For now, I'll place it here as requested, but it might lead to redundant updates or conflicts.
            // The original instruction had `progressEl` and `sentenceCountEl` which are not defined here.
            // I'll adapt it to use `scoreBadgeEl` and `sentenceCount` from the current scope.
            // If this is meant for `updateGroupCards`, it should be moved there.

            // Last Practiced - Use formatRelativeDate for friendlier output
            const lastPracticedEl = btn.querySelector('.last-practiced'); // Assuming .last-practiced is inside the button
            if (lastPracticedEl) {
                // Force cleanup
                lastPracticedEl.classList.remove('green-text', 'practiced-today');

                let dateToFormat = null;
                const groupData = completions[lang] && completions[lang][groupId];
                if (groupData && groupData.lastPracticed) {
                    dateToFormat = groupData.lastPracticed;
                }

                const formatted = formatRelativeDate(dateToFormat); // Returns 'Never' if null
                lastPracticedEl.textContent = formatted;

                if (formatted === 'Today') {
                    lastPracticedEl.classList.add('green-text', 'practiced-today');
                } else if (formatted === 'Yesterday') {
                    lastPracticedEl.classList.add('green-text');
                }
            }

            // Streak - Restore calculation
            const cardStreakEl = btn.querySelector('.group-streak'); // Assuming .group-streak is inside the button
            if (cardStreakEl) {
                cardStreakEl.classList.remove('green-text', 'has-streak');

                // Assuming calculateGroupStreak is defined elsewhere and takes lang and groupId
                const streakValue = calculateGroupStreak(lang, groupId);

                if (streakValue > 0) {
                    cardStreakEl.textContent = `${streakValue} day${streakValue > 1 ? 's' : ''}`;
                    cardStreakEl.classList.add('green-text', 'has-streak');
                } else {
                    cardStreakEl.textContent = '—';
                }
            }
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

        // Apply completion states
        const is100Percent = currentScore === totalScore && totalScore > 0;
        const practicedToday = group.date === today;
        const isPartial = currentScore > 0 && currentScore < totalScore;

        btn.classList.remove('complete-today', 'partial-progress');
        if (is100Percent && practicedToday) {
            btn.classList.add('complete-today');
        } else if (isPartial) {
            btn.classList.add('partial-progress');
        }

        // Update progress bar
        const progressFill = btn.querySelector('.fundamental-progress-fill');
        if (progressFill) {
            const percentage = totalScore > 0 ? (currentScore / totalScore) * 100 : 0;
            progressFill.style.width = `${percentage}%`;

            // Optional: Color change for 100%?
            if (is100Percent) {
                progressFill.style.backgroundColor = 'var(--success)';
            } else {
                progressFill.style.backgroundColor = ''; // Revert to default
            }
        }
    });

    // Update status hint
    updateFoundationsStatus();
}

// Update the "X/6 today" status hint
function updateFoundationsStatus() {
    const statusEl = document.getElementById('foundations-status');
    if (!statusEl) return;

    const fundamentalBtns = document.querySelectorAll('.fundamental-btn');
    const total = fundamentalBtns.length;
    let completed = 0;

    fundamentalBtns.forEach(btn => {
        if (btn.classList.contains('complete-today')) {
            completed++;
        }
    });

    statusEl.textContent = `${completed}/${total} today`;
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
    // 1. Calculate accuracy
    const accuracy = sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;

    // 2. Update text values (Stats Block)
    const correctEl = document.getElementById('correct-count');
    const missedEl = document.getElementById('missed-count');
    if (correctEl) correctEl.textContent = sessionStats.correct;
    if (missedEl) missedEl.textContent = sessionStats.missed;

    // 3. Update Ring & Percentage
    const accuracyEl = document.getElementById('completion-accuracy');
    const ring = document.getElementById('accuracy-ring');

    if (accuracyEl) accuracyEl.textContent = `${accuracy}%`;

    if (ring) {
        const radius = ring.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        // e.g. 2 * 3.14159 * 52 = 326.726

        const offset = circumference - (accuracy / 100) * circumference;

        // Reset stroke-dasharray just in case
        ring.style.strokeDasharray = `${circumference} ${circumference}`;

        // Small timeout to allow transition to happen if opening overly
        setTimeout(() => {
            ring.style.strokeDashoffset = offset;
        }, 100);

        // Color logic (Green for 100%, Accent for others or Red for very low?)
        // User requested subtle semantic color. 
        if (accuracy === 100) {
            ring.style.stroke = 'var(--success)';
        } else if (accuracy < 50) {
            ring.style.stroke = 'var(--danger)';
        } else {
            ring.style.stroke = 'var(--accent)';
        }
    }

    // 4. Update Header (Icon & Text)
    const icon = document.getElementById('completion-icon');
    const title = document.getElementById('completion-title');
    const subtitle = document.getElementById('completion-subtitle');

    if (icon && title && subtitle) {
        if (accuracy === 100) {
            icon.textContent = '🏆'; // Simple Emoji for now, could be SVG
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

    // 5. Button Logic (Standardized: Try Again = Primary, Back = Secondary)
    // User Request: "Primary button: Try Again", "Secondary button: Back to Groups"
    // Keep consistent across ALL states.
    const retryBtn = document.getElementById('retry-btn');
    const backBtn = document.getElementById('back-to-groups-btn');

    if (retryBtn && backBtn) {
        // ALWAYS keep this hierarchy per request
        retryBtn.className = 'btn btn-primary btn-block';
        backBtn.className = 'btn btn-secondary btn-block';

        // Optional: If specific text needed for Perfect Score (e.g. Next Group), add logic here
        // But user said: "Keep sizes consistent... For Perfect Score... Next Group (optional)"
        // Let's stick to standard "Try Again" for now to be safe, or just "Practice Again"
    }
}

let trainState = {
    lang: '',
    groupId: '',
    groupTitle: '',
    level: 'A1',        // Active CEFR level
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

    // Get the active level for this module
    trainState.level = window.getModuleLevel ? getModuleLevel(groupId) : 'A1';

    // Find the group with matching group_id AND level
    let group = allGroups.find(g => g.group_id === groupId && g.level === trainState.level);

    // Fallback to any matching group_id if level-specific not found
    if (!group) {
        group = allGroups.find(g => g.group_id === groupId);
    }

    if (!group || !group.sentences || group.sentences.length === 0) {
        showNoGroup();
        return;
    }

    trainState.groupId = group.group_id;
    trainState.groupTitle = group.group_title;
    trainState.groupDescription = group.description || '';

    // Use level-specific state key for save/resume
    const stateKey = `utteron_state_${trainState.groupId}_${trainState.level}`;
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
                console.log('Resuming session for group:', trainState.groupId, 'level:', trainState.level);
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
    document.getElementById('exercise-card').style.display = 'flex'; // Changed to flex for new layout
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
}

function setupEventListeners() {
    // Main action button (Reveal)
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

    // Retry button (on completion overlay)
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', retryGroup);
    }
}

function closeCompletion() {
    // Check if we are in the train.html context (has back-link)
    // or section.html context (modal).
    const trainApp = document.getElementById('train-app');

    if (trainApp) {
        // We are navigating away, so DO NOT hide the overlay or remove the completed class.
        // This prevents the "flash" of the underlying card content.

        // Try to find the back link provided by Hugo
        const backLink = document.querySelector('.back-link');
        if (backLink && backLink.href) {
            window.location.href = backLink.href;
        } else {
            // Fallback to parent directory or history
            const parentUrl = trainApp.dataset.parentUrl || '../';
            window.location.href = parentUrl;
        }
    } else {
        // Modal context (section.html) - We stay on page, so we MUST reset UI

        const overlay = document.getElementById('completion-overlay');
        if (overlay) overlay.style.display = 'none';

        document.getElementById('exercise-card').classList.remove('completed');

        const ui = document.getElementById('training-interface');
        if (ui) ui.style.display = 'none';

        const cards = document.querySelectorAll('.group-card.expanded');
        cards.forEach(c => toggleGroupCard(c.dataset.groupId)); // Close open card
    }
}

function retryGroup() {
    const overlay = document.getElementById('completion-overlay'); // Updated ID
    if (overlay) overlay.style.display = 'none';

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

    document.getElementById('exercise-card').classList.remove('completed');

    // Reset progress bar and show first exercise
    updateProgressBar();
    showCurrentExercise();
}

function showCurrentExercise() {
    const exercise = trainState.exercises[trainState.currentIndex];
    if (!exercise) return;

    const { sentence, type } = exercise;
    trainState.revealed = false;

    // Update progress
    document.getElementById('current-index').textContent = trainState.currentIndex + 1;

    // Reset visibility & Buttons
    const revealArea = document.getElementById('reveal-area');
    revealArea.classList.remove('visible'); // Hide answer

    document.getElementById('report-buttons').style.display = 'none';
    const actionBtn = document.getElementById('action-btn');
    actionBtn.style.display = 'block';
    actionBtn.textContent = 'Reveal';

    // Get Elements
    const promptArea = document.getElementById('prompt-area');
    const audioContainer = document.getElementById('audio-container');
    const audio = document.getElementById('audio-player');
    const exerciseType = document.getElementById('exercise-type');
    const replayBtn = document.getElementById('replay-btn');

    // Set Audio Source
    audio.src = sentence.audio;

    // Animate Content In (Remove exiting class if present)
    // First, clear inline styles for ALL slots to remove 'opacity: 0' from exit animation
    const allSlots = document.querySelectorAll('.content-slot');
    allSlots.forEach(slot => {
        slot.style.opacity = '';
        slot.style.transform = '';
    });

    // Then animate in non-answer slots
    const contentSlots = document.querySelectorAll('.content-slot:not(.answer-slot)');
    contentSlots.forEach(slot => {
        slot.style.opacity = '0';
        slot.style.transform = 'translateY(10px)';
        // Force reflow
        void slot.offsetWidth;
        slot.style.opacity = '1';
        slot.style.transform = 'translateY(0)';
    });

    if (type === 'listen') {
        // Listen Mode
        exerciseType.textContent = 'Listen & Translate';
        exerciseType.className = 'mode-badge listen';

        const genderHint = sentence.gender ? `<span class="gender-hint">${sentence.gender}</span>` : '';
        promptArea.innerHTML = `${genderHint}<p class="instruction">Listen to the audio, spell the word, then translate in your head.</p>`;

        audioContainer.style.display = 'flex';
        if (replayBtn) replayBtn.querySelector('span').textContent = 'Play Audio';

        revealArea.innerHTML = `
            <p class="native-text">${sentence.native}</p>
            <p class="english-text">${sentence.english}</p>
        `;

        // Autoplay
        setTimeout(() => {
            audio.play().catch(e => console.log('Autoplay blocked:', e));
        }, 300); // Slight delay for transition
    } else {
        // Read Mode
        exerciseType.textContent = 'Read & Speak';
        exerciseType.className = 'mode-badge read';

        promptArea.innerHTML = `<p class="native-text">${sentence.native}</p>
            <p class="instruction">Read aloud, then translate in your head.</p>`;

        audioContainer.style.display = 'none'; // Hidden initially

        revealArea.innerHTML = `
            <p class="english-text">${sentence.english}</p>
        `;
    }
}

function revealAnswer() {
    const exercise = trainState.exercises[trainState.currentIndex];
    const { type } = exercise;

    trainState.revealed = true;

    // Show reveal area with transition
    const revealArea = document.getElementById('reveal-area');
    revealArea.classList.add('visible');

    // Hide action button, show report buttons
    document.getElementById('action-btn').style.display = 'none';
    document.getElementById('report-buttons').style.display = 'flex';

    // For read mode, show and play audio
    if (type === 'read') {
        const audioContainer = document.getElementById('audio-container');
        audioContainer.style.display = 'flex';
        // Animate audio container in
        audioContainer.style.opacity = '0';
        audioContainer.style.transform = 'translateY(10px)';
        void audioContainer.offsetWidth;
        audioContainer.style.opacity = '1';
        audioContainer.style.transform = 'translateY(0)';

        document.getElementById('audio-player').play().catch(e => console.log('Play failed:', e));
    }
}

function recordAndAdvance(gotIt) {
    const exercise = trainState.exercises[trainState.currentIndex];
    const { sentence, type } = exercise;

    // Track session stats
    sessionStats.total++;
    if (gotIt) {
        sessionStats.correct++;
        markExerciseComplete(trainState.lang, trainState.groupId, sentence.id, type, trainState.level);
        checkAndUpdateStats(trainState.lang, trainState.groupId, trainState.exercises, trainState.level);
    } else {
        sessionStats.missed++;
    }

    // Advance to next
    trainState.currentIndex++;

    // Update progress bar
    updateProgressBar();

    // Save state
    const stateKey = `utteron_state_${trainState.groupId}_${trainState.level}`;
    if (trainState.currentIndex < trainState.exercises.length) {
        localStorage.setItem(stateKey, JSON.stringify({
            exercises: trainState.exercises,
            currentIndex: trainState.currentIndex,
            level: trainState.level,
            timestamp: new Date().toISOString()
        }));

        // Animate Out
        const contentSlots = document.querySelectorAll('.content-slot');
        contentSlots.forEach(slot => {
            slot.style.opacity = '0';
            slot.style.transform = 'translateY(-10px)';
        });

        // Wait for animation then show next
        setTimeout(() => {
            showCurrentExercise();
        }, 250);

    } else {
        // Clear state if finished
        try {
            localStorage.removeItem(stateKey);

            // Check completion
            const completions = getCompletions();
            const storageKey = `${trainState.groupId}_${trainState.level}`;
            const groupData = completions[trainState.lang]?.[storageKey];

            if (groupData && groupData.sentences) {
                const uniqueSentenceIds = [...new Set(trainState.exercises.map(e => e.sentence.id))];
                const allComplete = uniqueSentenceIds.every(id => {
                    const s = groupData.sentences[id];
                    return s && s.listen && s.read;
                });
                if (allComplete) {
                    recordGroupCompletion(trainState.lang, trainState.groupId, trainState.level);
                }
            }
        } catch (e) {
            console.error('Error during completion check:', e);
        }

        // Check if we are done
        if (trainState.currentIndex >= trainState.exercises.length) {
            // Prepare UI for completion
            try {
                document.getElementById('exercise-card').classList.add('completed');
                const overlay = document.getElementById('completion-overlay'); // Updated ID
                if (overlay) overlay.style.display = 'flex';

                displayCompletionStats();
            } catch (e) {
                console.error("Error showing completion:", e);
                // Fallback
                const overlay = document.getElementById('completion-overlay'); // Updated ID
                if (overlay) {
                    overlay.style.display = 'flex';
                    overlay.innerHTML = '<h2>Session Complete!</h2><button onclick="location.reload()">Reload</button>';
                }
            }
            return;
        }
    }
}

function checkAndUpdateStats(lang, groupId, exercises, level) {
    if (!exercises || exercises.length === 0) return;

    const completions = getCompletions();
    const today = getTodayDate();

    // Use level-specific key if level provided
    const storageKey = level ? `${groupId}_${level}` : groupId;

    // Ensure stats object exists
    if (!completions[lang]) completions[lang] = {};
    if (!completions[lang].stats) {
        completions[lang].stats = { streak: 0, lastStreakDate: null, completedGroups: [] };
    }

    const groupData = completions[lang][storageKey];
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
    // Show overlay
    const overlay = document.getElementById('completion-message');
    overlay.style.display = 'flex';

    // Hide header elements to clean up view? 
    // Actually, keeping the header (progress/mode) visible behind overlay might be distracting.
    // But the overlay covers everything with background color.
    // Let's ensure overlay covers the whole card content.
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

    section.classList.toggle('collapsed');
    const isCollapsed = section.classList.contains('collapsed');
    console.log('Toggled collapsed:', isCollapsed);
    localStorage.setItem('utteron_foundations_collapsed', isCollapsed);

    // Update toggle button text
    const toggleText = section.querySelector('.toggle-text');
    if (toggleText) {
        toggleText.textContent = isCollapsed ? 'Expand' : 'Collapse';
    }
}

// Initialize state on load
function initFoundationsState() {
    console.log('Initializing Foundations state');
    const section = document.getElementById('foundations-section');
    if (!section) return;

    const isCollapsed = localStorage.getItem('utteron_foundations_collapsed') === 'true';
    if (isCollapsed) {
        section.classList.add('collapsed');
        const toggleText = section.querySelector('.toggle-text');
        if (toggleText) {
            toggleText.textContent = 'Expand';
        }
    }
}

// Make sure functions are available globally
window.toggleFoundations = toggleFoundations;
window.initFoundationsState = initFoundationsState;

// ============================================
// Group Card Toggle Functions
// ============================================

// Toggle individual group card (Rolodex mode: only one card expanded at a time)
function toggleGroupCard(groupId) {
    const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
    if (!card) return;

    const wasMinimized = card.classList.contains('minimized');

    // Rolodex behavior: If we're about to expand this card, first collapse any other expanded cards
    if (wasMinimized) {
        const allCards = document.querySelectorAll('.group-card:not(.minimized)');
        allCards.forEach(openCard => {
            if (openCard.dataset.groupId !== groupId) {
                // Collapse this card immediately (no animation for the closing card)
                openCard.classList.add('minimized');
                const content = openCard.querySelector('.group-content-wrapper');
                const header = openCard.querySelector('.group-card-header-collapsed');
                if (content) {
                    content.style.maxHeight = '0px';
                    content.style.opacity = '0';
                }
                if (header) {
                    header.style.maxHeight = '200px';
                    header.style.opacity = '1';
                }
                // Update localStorage for the closed card
                const minimizedCards = JSON.parse(localStorage.getItem('utteron_minimized_cards') || '{}');
                minimizedCards[openCard.dataset.groupId] = true;
                localStorage.setItem('utteron_minimized_cards', JSON.stringify(minimizedCards));
            }
        });
    }

    card.classList.toggle('minimized');
    const isNowMinimized = card.classList.contains('minimized');

    // Smooth transition helper
    const content = card.querySelector('.group-content-wrapper');
    const header = card.querySelector('.group-card-header-collapsed');

    if (isNowMinimized) {
        // Collapsing: Measure height before collapsing to animate from
        content.style.maxHeight = content.scrollHeight + 'px';
        requestAnimationFrame(() => {
            content.style.maxHeight = '0px';
            content.style.opacity = '0';

            header.style.maxHeight = '200px'; // Allow header to expand
            header.style.opacity = '1';
        });
    } else {
        // Expanding
        header.style.maxHeight = '0px';
        header.style.opacity = '0';

        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.opacity = '1';

        // After transition, clear max-height to allow dynamic content (like switching levels)
        setTimeout(() => {
            if (!card.classList.contains('minimized')) { // Check if it's still expanded after transition
                content.style.maxHeight = 'none'; // Clear max-height to allow dynamic content

                // Scroll to card (optional, maybe distracting)
                // card.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Re-initialize state when opening
                updateGroupCardState(card, groupId);

                // CRITICAL: Update stats for the active level (default A1)
                const activeBadge = card.querySelector('.difficulty-badge.active');
                const level = activeBadge ? activeBadge.dataset.level : 'A1';
                updateCardStats(card, groupId, level);
            }
        }, 350);
    }

    // Save state to localStorage
    const minimizedCards = JSON.parse(localStorage.getItem('utteron_minimized_cards') || '{}');
    minimizedCards[groupId] = isNowMinimized;
    localStorage.setItem('utteron_minimized_cards', JSON.stringify(minimizedCards));

    // Update master toggle state
    updateMasterToggleState();
}

// Toggle all cards (master toggle)
// Toggle all cards (master toggle)
function toggleAllCards() {
    // Use the button or the header itself as trigger
    const headerBtn = document.getElementById('modules-toggle');
    const allCardsHeader = document.querySelector('.modules-header');
    const cards = document.querySelectorAll('.group-card');

    if (!cards.length) return;

    // Determine state from header class (source of truth)
    const isCurrentlyCollapsed = allCardsHeader.classList.contains('collapsed');

    // Helper function to safely update button text
    const updateButtonText = (text) => {
        if (!headerBtn) return;
        const span = headerBtn.querySelector('span');
        if (span) {
            span.textContent = text;
        } else {
            // Fallback: append text if span missing
            // But prefer preserving icon if it exists as a previous sibling
            // For now, assume span exists as per HTML structure
        }
    };

    if (isCurrentlyCollapsed) {
        // Expand all
        allCardsHeader.classList.remove('collapsed');
        cards.forEach(card => {
            try {
                card.classList.remove('minimized');
                // Trigger animation styles for expand
                const content = card.querySelector('.group-content-wrapper');
                const header = card.querySelector('.group-card-header-collapsed');
                if (content) {
                    content.style.maxHeight = 'none'; // Instant expand for batch action
                    content.style.opacity = '1';
                }
                if (header) {
                    header.style.maxHeight = '0';
                    header.style.opacity = '0';
                }

                // Ensure stats are up to date in the DOM for expanded view
                // (e.g. if level was changed in collapsed mode, expanded view needs to match)
                // Note: toggleGroupCard handles this for single opens. Batch open relies on
                // updateCardStats having run during init or level switch.
                const groupId = card.dataset.groupId;
                // Safety check for active badge
                const activeBadge = card.querySelector('.difficulty-badge.active');
                const level = activeBadge ? activeBadge.dataset.level : 'A1';

                if (window.updateCardStats) {
                    updateCardStats(card, groupId, level);
                }
            } catch (e) {
                console.warn('Error expanding card:', e);
            }
        });
        localStorage.setItem('utteron_all_cards_collapsed', 'false');
        localStorage.setItem('utteron_minimized_cards', '{}');
        updateButtonText('Collapse');
    } else {
        // Collapse all
        allCardsHeader.classList.add('collapsed');
        cards.forEach(card => {
            try {
                card.classList.add('minimized');
                // Trigger animation styles for collapse
                const content = card.querySelector('.group-content-wrapper');
                const header = card.querySelector('.group-card-header-collapsed');
                if (content) {
                    content.style.maxHeight = '0';
                    content.style.opacity = '0';
                }
                if (header) {
                    header.style.maxHeight = '200px';
                    header.style.opacity = '1';
                }
            } catch (e) {
                console.warn('Error collapsing card:', e);
            }
        });
        localStorage.setItem('utteron_all_cards_collapsed', 'true');
        updateButtonText('Expand');
    }
}

// Update master toggle based on individual card states
function updateMasterToggleState() {
    const header = document.querySelector('.modules-header');
    const cards = document.querySelectorAll('.group-card');
    const headerBtn = document.getElementById('modules-toggle');

    if (!header || !cards.length) return;

    // Check if ANY card is expanded (not minimized)
    const anyExpanded = Array.from(cards).some(card => !card.classList.contains('minimized'));

    // Helper to sync text
    const updateText = (text) => {
        if (!headerBtn) return;
        const span = headerBtn.querySelector('span');
        if (span) span.textContent = text;
    };

    if (anyExpanded) {
        // At least one card is expanded, so button should say "Collapse All"
        header.classList.remove('collapsed');
        updateText('Collapse');
    } else {
        // All cards are collapsed, so button should say "Expand All"
        header.classList.add('collapsed');
        updateText('Expand');
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

    // Check if this is the first load (no saved state exists)
    const hasExistingState = Object.keys(minimizedCards).length > 0;

    cards.forEach(card => {
        const groupId = card.dataset.groupId;

        if (hasExistingState) {
            // Use saved state from localStorage
            if (minimizedCards[groupId]) {
                card.classList.add('minimized');
            }
        } else {
            // First load: collapse all (strict default)
            card.classList.add('minimized');
        }
    });

    // Ensure header has collapsed class set when all cards are minimized
    if (header) {
        header.classList.add('collapsed');
    }
    updateMasterToggleState();
}

// Reset modules to default order and state
function resetModulesOrder() {
    // Get completions data
    const completions = getCompletions();
    const lang = document.getElementById('group-list')?.dataset.language;

    if (lang && completions[lang]) {
        // Clear timestamps from all groups to reset sorting order
        Object.keys(completions[lang]).forEach(key => {
            if (key !== 'stats' && completions[lang][key]) {
                // Keep completion data but remove timestamp and date
                delete completions[lang][key].timestamp;
                delete completions[lang][key].date;
            }
        });
        saveCompletions(completions);
    }

    // Clear card state localStorage
    localStorage.removeItem('utteron_minimized_cards');
    localStorage.removeItem('utteron_all_cards_collapsed');

    // Reset all cards to collapsed and clear any inline animation styles
    const cards = document.querySelectorAll('.group-card');
    cards.forEach(card => {
        card.classList.add('minimized');

        // Clear inline styles that might prevent visibility
        const content = card.querySelector('.group-content-wrapper');
        const header = card.querySelector('.group-card-header-collapsed');

        if (content) {
            content.style.maxHeight = '';
            content.style.opacity = '';
        }
        if (header) {
            header.style.maxHeight = '';
            header.style.opacity = '';
        }
    });

    // All cards remain minimized (strict reset)

    // Refresh module cards to restore weight order
    if (lang) {
        updateGroupCards(lang);
    }

    // Update the master toggle state
    updateMasterToggleState();
}

// Make functions globally accessible
window.toggleGroupCard = toggleGroupCard;
window.toggleAllCards = toggleAllCards;
window.initGroupCardState = initGroupCardState;
window.resetModulesOrder = resetModulesOrder;
