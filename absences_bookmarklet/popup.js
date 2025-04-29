// popup.js — loads scraped data from opener and renders UI

// Default sub-filters for absence/tardy types
console.log("popup.js loaded");


const defaultSubFilters = {
    absences: ['excused', 'unexcused'],
    tardies:  ['excused', 'unexcused']
  };
  
  // Initialize UI on load
  document.addEventListener('DOMContentLoaded', () => {
    // Re-render on filter changes
    document.getElementById('show-class-names')
            .addEventListener('change', loadAndDisplayData);
    document.querySelectorAll('input[name="mainFilter"]').forEach(radio => {
      radio.addEventListener('change', () => {
        setupSubFilters();
        loadAndDisplayData();
      });
    });
    document.getElementById('subFilters')
            .addEventListener('change', loadAndDisplayData);
  
    setupDefaultDates();
    setupSubFilters();
    loadAndDisplayData();  // show results immediately
  });
  
  // Set date inputs to start of semester and today
  function setupDefaultDates() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = today.getMonth() + 1;
    const startMonth = mm <= 6 ? 1 : 7;
    document.getElementById('start-date').value =
      `${yyyy}-${String(startMonth).padStart(2, '0')}-01`;
    document.getElementById('end-date').value =
      today.toISOString().split('T')[0];
  }
  
  // Render sub-filter checkboxes based on main filter
  function setupSubFilters() {
    const selected = document.querySelector('input[name="mainFilter"]:checked').value;
    const options = (selected === 'absences')
      ? ['activity', 'excused', 'unexcused']
      : ['excused', 'unexcused'];
    const defaults = defaultSubFilters[selected];
    const container = document.getElementById('subFilters');
    container.innerHTML = '';
  
    options.forEach(opt => {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `filter-${opt}`;
      cb.value = opt;
      cb.checked = defaults.includes(opt);
  
      const lbl = document.createElement('label');
      lbl.htmlFor = cb.id;
      lbl.innerText = opt.charAt(0).toUpperCase() + opt.slice(1);
  
      container.append(cb, lbl);
    });
  }
  
  // Determine type/status from attendance text
  function classify(entry) {
    const text = entry.attendance.toLowerCase();
    if (text.includes('tardy')) {
      if (text.includes('unexcused')) {
        return { type: 'tardy', status: 'unexcused' };
      } else if (text.includes('excused')) {
        return { type: 'tardy', status: 'excused' };
      } else {
        return { type: 'tardy', status: 'unexcused' }; // fallback
      }
    } else {
      if (text.includes('unexcused')) {
        return { type: 'absence', status: 'unexcused' };
      } else if (text.includes('activity')) {
        return { type: 'absence', status: 'activity' };
      } else if (text.includes('excused')) {
        return { type: 'absence', status: 'excused' };
      } else {
        return { type: 'absence', status: 'unexcused' }; // fallback
      }
    }
  }
  
  // Parse period strings like "1,3-4 & 6" into [1,3,4,6]
  function parsePeriods(periodStr) {
    const set = new Set();
    const parts = periodStr
      .replace(/&/g, ',')
      .replace(/-/g, ':')
      .replace(/\s+/g, '')
      .split(',');
  
    parts.forEach(part => {
      if (part.includes(':')) {
        let [start, end] = part.split(':').map(Number);
        for (let i = start; i <= end; i++) set.add(i);
      } else {
        set.add(Number(part));
      }
    });
  
    return Array.from(set);
  }
  
  // Main render function
  function loadAndDisplayData() {
    // Pull data that the bookmarklet stashed on window.opener
    const openerData = window.opener && window.opener._absencesData;
    const data = openerData?.missedData || [];
    const classNames = openerData?.classNames || [];
    const periods = {};
  
    // Date range
    const startDateInput = document.getElementById('start-date').value;
    const endDateInput   = document.getElementById('end-date').value;
    const startDate = startDateInput ? new Date(startDateInput) : new Date('2000-01-01');
    const endDate   = endDateInput   ? new Date(endDateInput)   : new Date('2100-01-01');
  
    // Filters
    const mainFilter = document.querySelector('input[name="mainFilter"]:checked').value;
    const subFilters = Array.from(
      document.querySelectorAll('#subFilters input:checked')
    ).map(cb => cb.value);
  
    // Aggregate
    data.forEach(entry => {
      const { type, status } = classify(entry);
      const dateObj = new Date(entry.date);
      if (dateObj < startDate || dateObj > endDate) return;
      if (type !== (mainFilter === 'tardies' ? 'tardy' : 'absence')) return;
      if (!subFilters.includes(status)) return;
  
      parsePeriods(entry.period).forEach(p => {
        if (!periods[p]) {
          periods[p] = { dates: [], className: classNames[p-1] || 'Unknown Class' };
        }
        periods[p].dates.push(entry.date);
      });
    });
  
    // Render buttons + dates
    const container = document.getElementById('periods');
    container.innerHTML = '';
    for (let p = 1; p <= 7; p++) {
      const pd = periods[p];
      if (!pd || pd.dates.length === 0) continue;
  
      const btn = document.createElement('button');
      btn.className = 'period-button';
      btn.style.color = 'black';
      const label = mainFilter === 'tardies' ? 'tardies' : 'missed';
      const showNames = document.getElementById('show-class-names').checked;
      btn.textContent = showNames
        ? `Period ${p} (${pd.className}) – ${pd.dates.length} ${label}`
        : `Period ${p} – ${pd.dates.length} ${label}`;
  
      const datesDiv = document.createElement('div');
      datesDiv.className = 'dates';
      datesDiv.innerHTML = pd.dates.map(d => `- ${d}`).join('<br>');
  
      btn.addEventListener('click', () => datesDiv.classList.toggle('show'));
  
      container.append(btn, datesDiv);
    }
  
    // Show absences remaining if in full absence mode
    const remDiv = document.getElementById('absences-remaining');
    if (
      mainFilter === 'absences' &&
      subFilters.length === 2 &&
      subFilters.includes('excused') &&
      subFilters.includes('unexcused')
    ) {
      let max = 0;
      Object.values(periods).forEach(pd => {
        if (pd.dates.length > max) max = pd.dates.length;
      });
      remDiv.innerText = `${10 - max} absences remaining`;
    } else {
      remDiv.innerText = '';
    }
  }
  