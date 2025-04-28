// default sub-filters
const defaultSubFilters = {
    absences: ['excused','unexcused'],
    tardies:  ['excused','unexcused']
  };
  
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('show-class-names')
            .addEventListener('change', loadAndDisplayData);
    document.querySelectorAll('input[name="mainFilter"]').forEach(r => {
      r.addEventListener('change', () => {
        setupSubFilters();
        loadAndDisplayData();
      });
    });
    document.getElementById('subFilters')
            .addEventListener('change', loadAndDisplayData);
  
    setupDefaultDates();
    setupSubFilters();
    loadAndDisplayData(); // show results right away
  });
  
  function setupDefaultDates() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = today.getMonth() + 1;
    const startMonth = mm <= 6 ? 1 : 7;
    document.getElementById('start-date').value =
      `${yyyy}-${String(startMonth).padStart(2,'0')}-01`;
    document.getElementById('end-date').value =
      today.toISOString().split('T')[0];
  }
  
  function setupSubFilters() {
    const sel = document.querySelector('input[name="mainFilter"]:checked').value;
    const opts = sel==='absences'
      ? ['activity','excused','unexcused']
      : ['excused','unexcused'];
    const def = defaultSubFilters[sel];
    const container = document.getElementById('subFilters');
    container.innerHTML = '';
    opts.forEach(opt => {
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = `filter-${opt}`;
      cb.value = opt; cb.checked = def.includes(opt);
      const lbl = document.createElement('label');
      lbl.htmlFor = cb.id;
      lbl.innerText = opt.charAt(0).toUpperCase()+opt.slice(1);
      container.append(cb, lbl);
    });
  }
  
  function classify(entry) { /* your existing classify() */ }
  
  function parsePeriods(str) { /* your existing parsePeriods() */ }
  
  function loadAndDisplayData() {
    // grab what the bookmarklet stashed
    const { missedData: data, classNames } =
      window.opener._absencesData || { missedData: [], classNames: [] };
  
    // same filtering + rendering logic as before, but using `data` & `classNames`
    // … copy your existing loadAndDisplayData body, swapping chrome.storage.local.get
    // for direct `data` and `classNames` variables …
  }
  