// Update the stats with corrected definitions
function updateLanguageStats(lang) {
    // Check if stats elements exist
    const streakEl = document.getElementById('stat-streak');
    if (!streakEl) return;

    const completions = getCompletions();
    const today = getTodayDate();

    // Global targets
    const DAILY_TARGET = 5;
    const WEEKLY_TARGET = 21;

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
    let groupsCompletedToday = 0;  // For "Today" stat
    let groupsCompletedThisWeek = 0;  // For "Week" stat
    let distinctGroupsPracticed = new Set();  // For "Groups" stat
    let totalPerfectPasses = 0;  // For "All" stat

    // Get total groups from DOM
    const cards = document.querySelectorAll('.group-card');
    const totalGroups = cards.length;

    // Calculate week start (7 days ago)
    const todayDate = new Date(today);
    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    if (completions[lang]) {
        Object.keys(completions[lang]).forEach(key => {
            if (key === 'stats') return;

            const group = completions[lang][key];

            // Add to distinct groups if any practice happened
            if (group.sentences && Object.values(group.sentences).length > 0) {
                distinctGroupsPracticed.add(key);
            }

            // Use completionHistory for accurate counts
            if (group.completionHistory) {
                Object.entries(group.completionHistory).forEach(([date, count]) => {
                    // Today: sum completions from today
                    if (date === today) {
                        groupsCompletedToday += count;
                    }

                    // Week: sum completions from last 7 days
                    if (date >= weekStartStr) {
                        groupsCompletedThisWeek += count;
                    }

                    // All: sum all completions
                    totalPerfectPasses += count;
                });
            }
        });
    }

    // 2. Today - x/5 (daily target)
    const todayEl = document.getElementById('stat-today');
    if (todayEl) {
        todayEl.textContent = `${groupsCompletedToday}/${DAILY_TARGET}`;
    }

    // 3. Week - x/21 (weekly target)
    const weekEl = document.getElementById('stat-week');
    if (weekEl) {
        weekEl.textContent = `${groupsCompletedThisWeek}/${WEEKLY_TARGET}`;
    }

    // 4. Groups - distinct groups practiced / total groups
    const groupsEl = document.getElementById('stat-completed');
    if (groupsEl) {
        groupsEl.textContent = `${distinctGroupsPracticed.size}/${totalGroups}`;
    }

    // 5. All - total 100% passes (all time)
    const allEl = document.getElementById('stat-all');
    if (allEl) {
        allEl.textContent = totalPerfectPasses;
    }
}

// Add playNativeName to main file for easier access
function playNativeName(text) {
    if (!text) return;

    // Use Web Speech API
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'cs-CZ'; // Czech language code - will be used for all languages (browser will try to adapt)

    window.speechSynthesis.speak(utterance);
}
