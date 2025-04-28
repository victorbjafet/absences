const defaultSubFilters = {
    absences: ['excused', 'unexcused'],   // <- activity is NOT selected by default
    tardies: ['excused', 'unexcused']
};



document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('input[name="mainFilter"]').forEach(radio => {
        radio.addEventListener('change', () => {
            setupSubFilters();    // <- re-render subfilters when switching
            loadAndDisplayData(); // <- reload filtered data correctly too
        });
    });
    
    setupDefaultDates();
    setupSubFilters();
    document.getElementById('scrape-btn').addEventListener('click', scrapeAndSave);
    document.querySelectorAll('input[name="mainFilter"]').forEach(radio => {
        radio.addEventListener('change', loadAndDisplayData);
    });
    document.getElementById('subFilters').addEventListener('change', loadAndDisplayData);

    loadAndDisplayData();
});

function setupDefaultDates() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = today.getMonth() + 1;

    let startMonth = mm <= 6 ? 1 : 7;
    let startDate = `${yyyy}-${startMonth.toString().padStart(2, '0')}-01`;

    document.getElementById('start-date').value = startDate;
    document.getElementById('end-date').value = today.toISOString().split('T')[0];
}

function setupSubFilters() {
    const container = document.getElementById('subFilters');
    container.innerHTML = ''; // Wipe old checkboxes

    const selected = document.querySelector('input[name="mainFilter"]:checked').value;
    
    const options = (selected === 'absences')
        ? ['activity', 'excused', 'unexcused']
        : ['excused', 'unexcused'];

    const selectedDefaults = {
        absences: ['excused', 'unexcused'],
        tardies: ['excused', 'unexcused']
    }[selected];

    options.forEach(opt => {
        const id = `filter-${opt}`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.value = opt;
        checkbox.checked = selectedDefaults.includes(opt);

        const label = document.createElement('label');
        label.htmlFor = id;
        label.innerText = opt.charAt(0).toUpperCase() + opt.slice(1);

        container.appendChild(checkbox);
        container.appendChild(label);
    });
}







async function scrapeAndSave() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    });

    setTimeout(loadAndDisplayData, 500);
}

function classify(entry) {
    const text = entry.attendance.toLowerCase();
    
    if (text.includes('tardy')) {
        // It's a tardy
        if (text.includes('unexcused')) {
            return { type: 'tardy', status: 'unexcused' };
        } else if (text.includes('excused')) {
            return { type: 'tardy', status: 'excused' };
        } else {
            return { type: 'tardy', status: 'unexcused' }; // default fallback
        }
    } else {
        // It's an absence
        if (text.includes('unexcused')) {
            return { type: 'absence', status: 'unexcused' };
        } else if (text.includes('activity')) {
            return { type: 'absence', status: 'activity' };
        } else if (text.includes('excused')) {
            return { type: 'absence', status: 'excused' };
        } else {
            return { type: 'absence', status: 'unexcused' }; // default fallback
        }
    }
}




function loadAndDisplayData() {
    chrome.storage.local.get(['missedData', 'classNames'], (result) => {
        const data = result.missedData || [];
        const classNames = result.classNames || [];
        const periods = {};

        const startDateInput = document.getElementById('start-date').value;
        const endDateInput = document.getElementById('end-date').value;
        const startDate = startDateInput ? new Date(startDateInput) : new Date('2000-01-01');
        const endDate = endDateInput ? new Date(endDateInput) : new Date('2100-01-01');

        const mainFilter = document.querySelector('input[name="mainFilter"]:checked').value;
        const selectedSubFilters = Array.from(document.querySelectorAll('#subFilters input:checked')).map(e => e.value);

        data.forEach(entry => {
            const { type, status } = classify(entry);
            const entryDate = new Date(entry.date);

            if (entryDate < startDate || entryDate > endDate) return;
            if (type !== (mainFilter === 'tardies' ? 'tardy' : 'absence')) return;
            if (!selectedSubFilters.includes(status)) return;

            const entryPeriods = parsePeriods(entry.period);
            entryPeriods.forEach(p => {
                if (!periods[p]) periods[p] = { dates: [], className: classNames[p - 1] || 'Unknown Class' };
                periods[p].dates.push(entry.date);
            });
        });

        const periodsContainer = document.getElementById('periods');
        periodsContainer.innerHTML = '';

        for (let p = 1; p <= 7; p++) {
            const periodData = periods[p];
            if (!periodData || periodData.dates.length === 0) continue;

            const button = document.createElement('button');
            button.className = 'period-button';
            button.style.color = 'black';

            const label = (mainFilter === 'tardies') ? 'tardies' : 'missed';
            button.textContent = `Period ${p} (${periodData.className}) \u2013 ${periodData.dates.length} ${label}`;

            const datesDiv = document.createElement('div');
            datesDiv.className = 'dates';
            datesDiv.innerHTML = periodData.dates.map(d => `- ${d}`).join('<br>');

            button.addEventListener('click', () => {
                datesDiv.classList.toggle('show');
            });

            periodsContainer.appendChild(button);
            periodsContainer.appendChild(datesDiv);
        }

        // --- NEW PART: handle absences remaining ---
        const absencesRemainingDiv = document.getElementById('absences-remaining');
        if (mainFilter === 'absences' &&
            selectedSubFilters.length === 2 &&
            selectedSubFilters.includes('excused') &&
            selectedSubFilters.includes('unexcused')) {

            // Find max missed in periods
            let maxMissed = 0;
            for (let p = 1; p <= 7; p++) {
                if (periods[p] && periods[p].dates.length > maxMissed) {
                    maxMissed = periods[p].dates.length;
                }
            }

            const remaining = 10 - maxMissed;
            absencesRemainingDiv.innerText = `${remaining} absences remaining`;

        } else {
            // Hide the label if not in default absence mode
            absencesRemainingDiv.innerText = '';
        }
    });
}




function parsePeriods(periodStr) {
    const periods = new Set();
    const parts = periodStr.replace(/&/g, ",").replace(/-/g, ":").replace(/\s+/g, '').split(',');
    for (let part of parts) {
        if (part.includes(':')) {
            const [start, end] = part.split(':').map(Number);
            for (let i = start; i <= end; i++) {
                periods.add(i);
            }
        } else {
            periods.add(Number(part));
        }
    }
    return Array.from(periods);
}
