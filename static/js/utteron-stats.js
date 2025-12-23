// Update the stats with corrected definitions
function updateLanguageStats(lang) {
    // Check if stats elements exist
    const streakEl = document.getElementById('stat-streak');
    if (!streakEl) return;

    const completions = getCompletions();
    const today = getTodayDate();

    // Get multipliers from localStorage or use defaults
    // today = daily target, week = multiplier for week (days), month = multiplier for month (weeks)
    const multipliers = JSON.parse(localStorage.getItem('stat_multipliers')) || {
        today: 5,      // Daily target
        week: 7,       // Days per week
        month: 4       // Weeks per month
    };

    // Calculate targets based on cascading multipliers
    const DAILY_TARGET = multipliers.today;
    const WEEKLY_TARGET = multipliers.today * multipliers.week;
    const MONTHLY_TARGET = multipliers.today * multipliers.week * multipliers.month;

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
    let totalPerfectPasses = 0;

    // Calculate date ranges
    const todayDate = new Date(today);

    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const monthStart = new Date(todayDate);
    monthStart.setDate(monthStart.getDate() - 30);
    const monthStartStr = monthStart.toISOString().split('T')[0];

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

    // 5. All - total 100% passes (all time)
    const allEl = document.getElementById('stat-all');
    if (allEl) {
        allEl.textContent = totalPerfectPasses;
    }
}

// Initialize stat arrow controls
function initStatArrows() {
    const multipliers = JSON.parse(localStorage.getItem('stat_multipliers')) || {
        today: 5,      // Daily target
        week: 7,       // Days per week
        month: 4       // Weeks per month
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

// Play native name audio - uses audio file if available, falls back to speech synthesis
function playNativeName(langCode) {
    if (!langCode) return;

    // Map language codes to audio files
    const audioFiles = {
        'czech': '/assets/audio/czech/cz_001.mp3'
    };

    const audioPath = audioFiles[langCode];

    if (audioPath) {
        // Use audio file
        const audio = new Audio(audioPath);
        audio.play().catch(e => console.log('Audio play failed:', e));
    } else {
        // Fallback to Web Speech API
        const langMap = { 'czech': 'cs-CZ' };
        const utterance = new SpeechSynthesisUtterance(langCode);
        utterance.lang = langMap[langCode] || 'en-US';
        window.speechSynthesis.speak(utterance);
    }
}

// Update fundamentals buttons with scores and completion status
function updateFundamentalsButtons(lang) {
    const fundamentalBtns = document.querySelectorAll('.fundamental-btn');
    if (!fundamentalBtns.length) return;

    const completions = getCompletions();
    const today = getTodayDate();

    fundamentalBtns.forEach(btn => {
        const groupId = btn.dataset.groupId;
        const sentenceCount = parseInt(btn.dataset.sentenceCount) || 0;
        const scoreEl = btn.querySelector('.fundamental-score');

        if (!completions[lang] || !completions[lang][groupId]) {
            scoreEl.textContent = `0/${sentenceCount}`;
            btn.classList.remove('complete-today');
            return;
        }

        const group = completions[lang][groupId];

        // Count sentences where BOTH listen AND read are completed
        let completedCount = 0;
        if (group.sentences) {
            Object.values(group.sentences).forEach(s => {
                if (s.listen && s.read) {
                    completedCount++;
                }
            });
        }

        scoreEl.textContent = `${completedCount}/${sentenceCount}`;

        // Highlight green ONLY if:
        // 1. All sentences are complete (100%)
        // 2. The group was completed today
        const is100Percent = completedCount === sentenceCount && sentenceCount > 0;
        const completedToday = group.completionHistory && group.completionHistory[today];

        if (is100Percent && completedToday) {
            btn.classList.add('complete-today');
        } else {
            btn.classList.remove('complete-today');
        }
    });
}
