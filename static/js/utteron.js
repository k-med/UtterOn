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

// Make functions globally accessible
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

    saveCompletions(completions);
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

    // Now update each card's display
    cardsWithDates.forEach(({ card, groupId, storageKey, level }) => {
        const sentenceCount = parseInt(card.dataset.sentenceCount) || 0;
        const totalExercises = sentenceCount * 2;

        // Get level-specific completion data
        const groupData = completions[lang]?.[storageKey];

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


        // Update Streak - show consecutive days group was 100% completed (level-specific)
        const streakEl = card.querySelector('.group-streak');
        if (streakEl) {
            const streak = calculateGroupStreak(lang, storageKey);
            if (streak > 0) {
                streakEl.textContent = `${streak} day${streak !== 1 ? 's' : ''}`;
                streakEl.classList.add('has-streak');
            } else {
                streakEl.textContent = '—';
                streakEl.classList.remove('has-streak');
            }
        }

        // Update Score - shows session progress (0/total, updates during active session)
        const scoreEl = card.querySelector('.last-score');
        if (scoreEl) {
            // Check if there's an active session for this group/level
            const stateKey = `utteron_state_${groupId}_${level}`;
            const savedState = localStorage.getItem(stateKey);

            let sessionCompleted = 0;
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    // Count completed exercises from saved state
                    if (state.completedExercises) {
                        sessionCompleted = state.completedExercises.length;
                    } else if (state.currentIndex) {
                        // Fallback: use current index as approximate progress
                        sessionCompleted = state.currentIndex;
                    }
                } catch (e) {
                    console.warn('Failed to parse saved state:', e);
                }
            }

            // Fallback: count from level-specific completions
            if (sessionCompleted === 0 && groupData?.sentences) {
                Object.values(groupData.sentences).forEach(s => {
                    if (s.listen) sessionCompleted++;
                    if (s.read) sessionCompleted++;
                });
            }

            const is100Percent = sessionCompleted === totalExercises && totalExercises > 0;
            scoreEl.textContent = `${sessionCompleted} / ${totalExercises}`;
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

        // Update Start/Resume button (expanded card) - use level-specific state key
        const startBtn = card.querySelector('.start-btn');
        const resumeStateKey = `utteron_state_${groupId}_${level}`;
        const hasResume = localStorage.getItem(resumeStateKey);

        if (startBtn) {
            if (hasResume) {
                startBtn.textContent = 'Resume';
                startBtn.classList.add('resume-mode');
            } else {
                startBtn.textContent = 'Start';
                startBtn.classList.remove('resume-mode');
            }
        }

        // Update collapsed header Start/Resume button
        const compactBtn = card.querySelector('.start-btn-compact');
        if (compactBtn) {
            if (hasResume) {
                compactBtn.textContent = 'Resume';
                compactBtn.classList.add('resume-mode');
            } else {
                compactBtn.textContent = 'Start';
                compactBtn.classList.remove('resume-mode');
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

    // Update button highlight based on accuracy
    const backBtn = document.getElementById('back-to-groups-btn');
    const retryBtn = document.getElementById('retry-btn');

    if (backBtn && retryBtn) {
        if (accuracy === 100) {
            // 100% = highlight Back to Groups (primary), dim Try Again (secondary)
            backBtn.classList.remove('secondary');
            backBtn.classList.add('primary');
            retryBtn.classList.remove('primary');
            retryBtn.classList.add('secondary');
        } else {
            // < 100% = highlight Try Again (primary), dim Back to Groups (secondary)
            backBtn.classList.remove('primary');
            backBtn.classList.add('secondary');
            retryBtn.classList.remove('secondary');
            retryBtn.classList.add('primary');
        }
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

            // Hide completion overlay
            document.getElementById('completion-message').style.display = 'none';

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

        // Display completion stats
        displayCompletionStats();

        // Animate Out before showing completion
        const contentSlots = document.querySelectorAll('.content-slot');
        contentSlots.forEach(slot => {
            slot.style.opacity = '0';
        });

        setTimeout(() => {
            showCompletion();
        }, 250);
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

    // Reset all cards to collapsed
    const cards = document.querySelectorAll('.group-card');
    cards.forEach(card => {
        card.classList.add('minimized');
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
