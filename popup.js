// popup.js — loads scraped data from opener and renders UI

// Default sub-filters for absences vs. tardies
const defaultSubFilters = {
    absences: ['excused','unexcused'],
    tardies:  ['excused','unexcused']
  };
  
  document.addEventListener('DOMContentLoaded', () => {
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
  
    setupDefaultDates();
    setupSubFilters();
    loadAndDisplayData();
  });
  
  function setupDefaultDates() {
    const today = new Date(),
          yyyy = today.getFullYear(),
          mm   = today.getMonth() + 1,
          startMonth = mm <= 6 ? 1 : 7;
    document.getElementById('start-date').value =
      `${yyyy}-${String(startMonth).padStart(2,'0')}-01`;
    document.getElementById('end-date').value =
      today.toISOString().split('T')[0];
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
      const cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.id      = `filter-${opt}`;
      cb.value   = opt;
      cb.checked = defs.includes(opt);
  
      const lbl = document.createElement('label');
      lbl.htmlFor = cb.id;
      lbl.innerText = opt[0].toUpperCase() + opt.slice(1);
  
      container.append(cb, lbl);
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
      } else if (t.includes('activity')) {
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
    return [...S];
  }
  
  function loadAndDisplayData() {
    // Pull the data that content.js stashed on the opener
    const openerData = window.opener && window.opener._absencesData;
    const data       = openerData?.missedData  || [];
    const classNames = openerData?.classNames  || [];
    const periods    = {};
  
    // date filters
    const start = document.getElementById('start-date').value,
          end   = document.getElementById('end-date').value,
          sd = start ? new Date(start) : new Date('2000-01-01'),
          ed = end   ? new Date(end)   : new Date('2100-01-01');
  
    // main + sub filters
    const main = document.querySelector('input[name="mainFilter"]:checked').value;
    const subs = [...document.querySelectorAll('#subFilters input:checked')].map(i=>i.value);
  
    data.forEach(e => {
      const {type,status} = classify(e),
            d = new Date(e.date);
      if (d < sd || d > ed) return;
      if (type !== (main==='tardies'?'tardy':'absence')) return;
      if (!subs.includes(status)) return;
  
      parsePeriods(e.period).forEach(p => {
        if (!periods[p]) periods[p] = { dates: [], className: classNames[p-1] || 'Unknown Class' };
        periods[p].dates.push(e.date);
      });
    });
  
    // render
    const cont = document.getElementById('periods');
    cont.innerHTML = '';
    for (let p=1; p<=7; p++) {
      const pd = periods[p];
      if (!pd || !pd.dates.length) continue;
      const btn = document.createElement('button');
      btn.className = 'period-button';
      btn.style.color = 'black';
      const label = main==='tardies'? 'tardies':'missed';
      const showN = document.getElementById('show-class-names').checked;
      btn.textContent = showN
        ? `Period ${p} (${pd.className}) – ${pd.dates.length} ${label}`
        : `Period ${p} – ${pd.dates.length} ${label}`;
  
      const ddiv = document.createElement('div');
      ddiv.className = 'dates';
      ddiv.innerHTML = pd.dates.map(d=>`- ${d}`).join('<br>');
      btn.onclick = ()=> ddiv.classList.toggle('show');
  
      cont.append(btn, ddiv);
    }
  
    // absences remaining
    const rem = document.getElementById('absences-remaining');
    if (main==='absences' && subs.length===2 && subs.includes('excused') && subs.includes('unexcused')) {
      let mx = 0;
      Object.values(periods).forEach(pd => { if (pd.dates.length>mx) mx=pd.dates.length; });
      rem.innerText = `${10 - mx} full-day absences remaining`;
    } else {
      rem.innerText = '';
    }
  }
  