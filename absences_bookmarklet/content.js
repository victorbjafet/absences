(function init() {
    // Only run on the Skyward attendance page
    const allowRe = /^https:\/\/skyward\.iscorp\.com\/scripts\/wsisa\.dll\/WService=wseduamericanheritagefl\/sfattendance001\.w/;
    if (!allowRe.test(window.location.href)) {
        alert("This bookmarklet only works on Skyward's attendance history page.");
        return;
    }

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
  Promise.all([
    fetch(`${base}/popup.html`).then(r => r.text()),
    fetch(`${base}/popup.js`).then(r => r.text())
  ]).then(([html, js]) => {
    // remove the old <script src="popup.js"></script>
    const cleanHtml = html.replace(
      /<script\s+src=["']popup\.js["']>\s*<\/script>/,
      ''
    );

    // inject the JS just before </body>
    const finalHtml = cleanHtml.replace(
      /<\/body>/i,
      `<script>\n${js}\n</script>\n</body>`
    );

    const pop = window.open('', '_blank', 'width=700,height=800');
    pop.document.write(finalHtml);
    pop.document.close();
  });
})();
  