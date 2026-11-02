// popup.js — loads scraped data from the Skyward page and renders UI

// Default sub-filters for absences vs. tardies
const defaultSubFilters = {
    absences: ['excused','unexcused'],
    tardies:  ['excused','unexcused']
  };

  // content.js shows this page in an iframe over Skyward (older versions used a popup window)
  const host     = window.opener || window.parent;
  const hostData = (host !== window && host._absencesData) || {};
  // older content.js versions sent a single student's missedData
  const students = hostData.students || [{ name: '', missedData: hostData.missedData || [] }];

  // periods the user has expanded, kept open when the list re-renders
  const expanded = new Set();

  function closeViewer() {
    if (hostData.close) hostData.close();
    else window.close();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close').addEventListener('click', closeViewer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeViewer(); });

    // When filters change, re-render
    document.getElementById('show-class-names')
            .addEventListener('change', loadAndDisplayData);
    document.querySelectorAll('input[name="mainFilter"]')
            .forEach(r => r.addEventListener('change', () => {
              setupSubFilters();
              loadAndDisplayData();
            }));
    document.getElementById('subFilters')
            .addEventListener('change', loadAndDisplayData);

    document.getElementById('start-date')
            .addEventListener('change', loadAndDisplayData);
    document.getElementById('end-date')
            .addEventListener('change', loadAndDisplayData);

    setupStudents();
    setupDefaultDates();
    setupSubFilters();
    loadAndDisplayData();
  });

  // parent accounts can have several students; show a picker for them, else just the name
  function setupStudents() {
    const cont = document.getElementById('student');
    if (students.length > 1) {
      const sel = document.createElement('select');
      sel.id = 'student-select';
      sel.setAttribute('aria-label', 'Student');
      students.forEach((s, i) => sel.add(new Option(s.name, i)));
      sel.addEventListener('change', loadAndDisplayData);
      cont.append(sel);
    } else {
      cont.textContent = students[0].name;
    }
    cont.hidden = !cont.textContent && students.length < 2;
  }

  // YYYY-MM-DD in local time (toISOString is UTC, which is already tomorrow on US evenings)
  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Skyward dates look like "Mon Nov 2, 2026"; returns YYYY-MM-DD, or null if unparseable
  function parseSkywardDate(str) {
    const m = str.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (m) {
      const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase());
      if (month >= 0) return isoDate(new Date(Number(m[3]), month, Number(m[2])));
    }
    const d = new Date(str);
    return isNaN(d) ? null : isoDate(d);
  }

  function setupDefaultDates() {
    const today = new Date(),
          yyyy = today.getFullYear(),
          mm   = today.getMonth() + 1,
          startMonth = mm <= 6 ? 1 : 7;
    document.getElementById('start-date').value =
      `${yyyy}-${String(startMonth).padStart(2,'0')}-01`;
    document.getElementById('end-date').value = isoDate(today);
  }

  function setupSubFilters() {
    const sel = document.querySelector('input[name="mainFilter"]:checked').value,
          opts = (sel === 'absences')
               ? ['activity','excused','unexcused']
               : ['excused','unexcused'],
          defs = defaultSubFilters[sel],
          container = document.getElementById('subFilters');
    container.innerHTML = '';
    opts.forEach(opt => {
      const span = document.createElement('span');
      const cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.id      = `filter-${opt}`;
      cb.value   = opt;
      cb.checked = defs.includes(opt);

      const lbl = document.createElement('label');
      lbl.htmlFor = cb.id;
      lbl.innerText = opt[0].toUpperCase() + opt.slice(1);

      // wrapped so a checkbox never wraps onto a different line than its label
      span.append(cb, lbl);
      container.append(span);
    });
  }

  function classify(entry) {
    const t = entry.attendance.toLowerCase();
    if (t.includes('tardy')) {
      // For tardies, check unexcused first (so "unexcused" doesn't get mistaken as "excused")
      if (t.includes('unexcused')) {
        return { type: 'tardy', status: 'unexcused' };
      } else if (t.includes('excused')) {
        return { type: 'tardy', status: 'excused' };
      } else {
        return { type: 'tardy', status: 'unexcused' };
      }
    } else {
      // Absences
      if (t.includes('unexcused')) {
        return { type: 'absence', status: 'unexcused' };
      } else if (t.includes('activity') || t.includes('exempt')) {
        return { type: 'absence', status: 'activity' };
      } else if (t.includes('excused')) {
        return { type: 'absence', status: 'excused' };
      } else {
        return { type: 'absence', status: 'unexcused' };
      }
    }
  }

  function parsePeriods(str) {
    const S = new Set(),
          parts = str.replace(/&/g,',').replace(/-/g,':').replace(/\s+/g,'').split(',');
    parts.forEach(p => {
      if (p.includes(':')) {
        let [a,b] = p.split(':').map(Number);
        for (; a<=b; a++) S.add(a);
      } else {
        S.add(Number(p));
      }
    });
    return [...S].filter(n => !isNaN(n));
  }

  function loadAndDisplayData() {
    const studentSelect = document.getElementById('student-select');
    const student    = students[studentSelect ? Number(studentSelect.value) : 0];
    const data       = student.missedData;
    const periods    = {};

    // date filters (YYYY-MM-DD strings compare correctly as plain strings)
    const start = document.getElementById('start-date').value,
          end   = document.getElementById('end-date').value;

    // main + sub filters
    const main = document.querySelector('input[name="mainFilter"]:checked').value;
    const subs = [...document.querySelectorAll('#subFilters input:checked')].map(i=>i.value);

    data.forEach(e => {
      const {type,status} = classify(e),
            d = parseSkywardDate(e.date);
      if (d && ((start && d < start) || (end && d > end))) return;
      if (type !== (main==='tardies'?'tardy':'absence')) return;
      if (!subs.includes(status)) return;

      // each entry lists its classes in period order; only trust that list if the counts line up
      const nums  = parsePeriods(e.period),
            names = (e.classes && e.classes.length === nums.length) ? e.classes : [];
      nums.forEach((p, i) => {
        if (!periods[p]) periods[p] = { entries: [], classNames: [] };
        periods[p].entries.push(e);
        if (names[i] && !periods[p].classNames.includes(names[i])) periods[p].classNames.push(names[i]);
      });
    });

    // render
    const cont = document.getElementById('periods');
    cont.innerHTML = '';
    const showN = document.getElementById('show-class-names').checked;
    Object.keys(periods).map(Number).sort((a,b) => a-b).forEach(p => {
      const pd = periods[p],
            n  = pd.entries.length;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'period-button';
      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.textContent = '▶';
      const name = document.createElement('span');
      name.className = 'period-name';
      name.textContent = `Period ${p}`;
      btn.append(caret, name);
      if (showN) {
        // a period can list more than one class if the schedule changed within the date range
        const cls = document.createElement('span');
        cls.className = 'class-name';
        cls.textContent = pd.classNames.join(' / ') || 'Unknown Class';
        btn.append(cls);
      }
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = main==='tardies' ? `${n} ${n===1 ? 'tardy' : 'tardies'}` : `${n} missed`;
      btn.append(count);

      const ddiv = document.createElement('div');
      ddiv.className = 'dates';
      const list = document.createElement('ul');
      pd.entries.forEach(e => {
        const li = document.createElement('li');
        const date = document.createElement('span');
        date.textContent = e.date;
        const why = document.createElement('span');
        why.className = 'why';
        why.textContent = e.attendance;
        li.append(date, why);
        list.append(li);
      });
      ddiv.append(list);

      const setOpen = open => {
        ddiv.classList.toggle('show', open);
        btn.setAttribute('aria-expanded', open);
        if (open) expanded.add(p); else expanded.delete(p);
      };
      setOpen(expanded.has(p));
      btn.onclick = () => setOpen(!ddiv.classList.contains('show'));

      cont.append(btn, ddiv);
    });

    if (!cont.children.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = data.length ? `No ${main} match these filters.` : 'No attendance records found.';
      cont.append(empty);
    }

    // absences remaining
    const rem = document.getElementById('absences-remaining');
    rem.className = '';
    if (main==='absences' && subs.length===2 && subs.includes('excused') && subs.includes('unexcused')) {
      let mx = 0;
      Object.values(periods).forEach(pd => { if (pd.entries.length>mx) mx=pd.entries.length; });
      const left = 10 - mx;
      rem.innerText = left >= 0
        ? `${left} full-day absence${left===1 ? '' : 's'} remaining`
        : `Over the limit by ${-left} absence${left===-1 ? '' : 's'}`;
      if (left <= 0) rem.className = 'danger';
      else if (left <= 3) rem.className = 'warn';
    } else {
      rem.innerText = '';
    }
  }
