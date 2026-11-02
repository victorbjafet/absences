(function init() {
    // 1) find the attendance tables (parent accounts get one per student). Checking for the
    //    tables instead of the URL keeps this working when Skyward moves its pages around
    const tables = [...document.querySelectorAll('table[id^="grid_attendanceHistory"]')];
    if (!tables.length) {
      alert("This bookmarklet only works on Skyward's attendance page. Open the Attendance tab in Skyward and try again.");
      return;
    }

    // 2) map each "View Classes" link to its class list. The list lives in the link's click
    //    handler (an inline script) and has one class per period, in period order
    const scriptText = [...document.querySelectorAll('script')].map(s => s.textContent).join('\n');
    const classLists = {};
    for (const [handler, linkId] of scriptText.matchAll(/viewClassesDialog[\s\S]*?'#([\w-]+)'\)/g)) {
      const m = handler.match(/html['"]?\s*:\s*'((?:\\.|[^'\\])*)'/);
      if (!m) continue;
      const raw = m[1]
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\(.)/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' })[c] || c);
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      classLists[linkId] = [...doc.querySelectorAll('a')].map(a => a.textContent.trim());
    }

    // 3) scrape each table. textContent (not innerText) so hidden tabs still read correctly
    const text = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    const students = tables.map((table, i) => {
      // finding columns by header name in case Skyward reorders them
      const headers = [...table.querySelectorAll('th')].map(th => text(th).toLowerCase());
      const col = (name, fallback) => {
        const idx = headers.findIndex(h => h.includes(name));
        return idx === -1 ? fallback : idx;
      };
      const dateCol = col('date', 0), attendanceCol = col('attendance', 1),
            periodCol = col('period', 2), classCol = col('class', 3);

      const missedData = [];
      table.querySelectorAll('tr').forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length < 3 || !text(cols[dateCol])) return;
        // single-period rows show the class name directly, multi-period rows show a "View Classes" link
        const classCell = cols[classCol];
        const link = classCell && classCell.querySelector('a');
        let classes = [];
        if (link && classLists[link.id]) classes = classLists[link.id];
        else if (text(classCell) && !/view classes/i.test(text(classCell))) classes = [text(classCell)];
        missedData.push({
          date: text(cols[dateCol]),
          attendance: text(cols[attendanceCol]),
          period: text(cols[periodCol]),
          classes
        });
      });

      // the tab above each table reads like "Name (School)"
      const tag = table.closest('.gridWrap')?.querySelector('.sfTag');
      return { name: text(tag) || (tables.length > 1 ? `Student ${i + 1}` : ''), missedData };
    });

    // 4) show the viewer in an overlay on top of Skyward. Unlike a popup window it can't be
    //    blocked and fits on phones, and the iframe keeps Skyward's CSS from leaking into it
    window._absencesData?.close?.(); // bookmarklet clicked twice
    const narrow = window.innerWidth < 640;
    const overlay = document.createElement('div');
    overlay.id = 'absences-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:rgba(0,0,0,.4);' +
      `padding:${narrow ? 0 : 16}px`;
    const frame = document.createElement('iframe');
    frame.title = 'Attendance summary';
    frame.style.cssText = 'width:100%;max-width:640px;height:100%;background:#fff;' + (narrow
      ? 'border:0'
      : 'max-height:820px;border:1px solid #b4c1ce;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.3)');
    frame.srcdoc = '<p style="font:14px arial,sans-serif;text-align:center;margin-top:40px">Loading...</p>';
    frame.onload = () => frame.focus(); // so Escape and keyboard navigation work right away
    overlay.append(frame);

    const prevOverflow = document.documentElement.style.overflow;
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prevOverflow;
      delete window._absencesData;
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    document.body.append(overlay);

    // 5) stash on the page so popup.js can grab it
    window._absencesData = { students, close };

    // 6) load popup.html + popup.js into the overlay
    const base = 'https://raw.githubusercontent.com/victorbjafet/absences/main';
    const get = path => fetch(`${base}/${path}`).then(r => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.text();
    });
    Promise.all([get('popup.html'), get('popup.js')]).then(([html, js]) => {
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

      frame.srcdoc = finalHtml;
    }).catch(err => {
      close();
      alert(`Couldn't load the attendance viewer (${err.message}). Check your connection and try again.`);
    });
})();
