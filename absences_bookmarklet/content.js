(function() {
    // 1) scrape the attendance table & class names
    const table = document.querySelector('table[id^="grid_attendanceHistory"]');
    if (!table) {
      alert('Skyward attendance table not found on this page.');
      return;
    }
    const rows = table.querySelectorAll('tr');
    const missedData = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].querySelectorAll('td');
      if (cols.length < 3) continue;
      missedData.push({
        date: cols[0].innerText.trim(),
        attendance: cols[1].innerText.trim(),
        period: cols[2].innerText.trim()
      });
    }
    const classNames = [];
    document.querySelectorAll('script').forEach(script => {
      const t = script.innerText;
      if (t.includes('viewClassesDialog') && t.includes('<a')) {
        const m = t.match(/html:'(.*?)',title:/s);
        if (m && m[1]) {
          const raw = m[1]
            .replace(/\\u0027/g, "'")
            .replace(/\\u0022/g, '"')
            .replace(/\\\//g, '/');
          const d = document.createElement('div');
          d.innerHTML = raw;
          d.querySelectorAll('a').forEach(a => classNames.push(a.innerText.trim()));
        }
      }
    });
  
    // 2) stash on the page so popup.js can grab it
    window._absencesData = { missedData, classNames };
  
    // 3) open a popup and load your existing popup.html + popup.js
    const base = 'https://raw.githubusercontent.com/victorbjafet/absences/main/absences_bookmarklet';
    fetch(`${base}/popup.html`)
      .then(r => r.text())
      .then(html => {
        // point its <script src="popup.js"> to your GitHub raw file
        const mod = html.replace(
          /<script\s+src=["']popup\.js["']><\/script>/,
          `<script src="${base}/popup.js"></script>`
        );
        const pop = window.open('', '_blank', 'width=600,height=700');
        pop.document.write(mod);
        pop.document.close();
      });
  })();
  