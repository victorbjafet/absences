(function scrapeAttendance() {
    const table = document.querySelector('table[id^="grid_attendanceHistory"]');
    if (!table) {
        console.error('Attendance table not found.');
        return;
    }
    const rows = table.querySelectorAll('tr');
    const missed_school_dates = [];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].querySelectorAll('td');
        if (cols.length >= 3) {
            const date = cols[0].innerText.trim();
            const attendance = cols[1].innerText.trim();
            const period = cols[2].innerText.trim();

            missed_school_dates.push({ date, attendance, period });
        }
    }

    let classNames = [];
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
        const text = script.innerText;
        if (text.includes('viewClassesDialog') && text.includes('<a')) {
            const htmlBlockMatch = text.match(/html:'(.*?)',title:/s);

            if (htmlBlockMatch && htmlBlockMatch[1]) {
                const rawHtml = htmlBlockMatch[1]
                    .replace(/\\u0027/g, "'")
                    .replace(/\\u0022/g, '"')
                    .replace(/\\\//g, "/");

                if (rawHtml) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = rawHtml;

                    const links = tempDiv.querySelectorAll('a');
                    if (links && links.length > 0) {
                        links.forEach(link => {
                            classNames.push(link.innerText.trim());
                        });
                    }
                }
            }
            break; // Done after first match attempt
        }
    }

    chrome.storage.local.set({ missedData: missed_school_dates, classNames: classNames }, () => {
        console.log('Attendance data + class names saved.');
    });
})();
