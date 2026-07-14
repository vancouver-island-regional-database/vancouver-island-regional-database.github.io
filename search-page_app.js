/* search-page_app.js - Document & Closed Sessions Page Logic */

function initApp() {
  let currentPage = 1;
  let selectedJurs = ["Town of Ladysmith", "District of North Cowichan", "Cowichan Valley Regional District", "School District 68", "Stz'uminus First Nation"];

  // Raw lists to store response data
  let rawIncameraData = [];
  let rawDocumentsData = [];

  // Store filtered lists globally for CSV export
  let filteredDocumentsList = [];
  let filteredIncameraList = [];

  // Sort states
  let incameraDateAsc = false;
  let docDateAsc = false;

  // Multi-select header filter lists
  let selectedDocJurList = [];
  let selectedDocAppJurList = [];
  let selectedDocTagsList = [];
  let selectedDocTypeList = [];

  let selectedIncameraJurList = [];
  let selectedIncameraTypeList = [];
  let selectedStatutoryList = [];
  let selectedAttendeesList = [];

  let selectedCategories = [];
  let selectedProjects = [];
  let selectedMemberFilter = '';

  // Selectors
  const jurDropdownTrigger = document.getElementById('jurDropdownTrigger');
  const jurDropdownMenu = document.getElementById('jurDropdownMenu');
  const jurSearchInput = document.getElementById('jurSearchInput');
  const jurApplyBtn = document.getElementById('jurApplyBtn');
  const jurClearBtn = document.getElementById('jurClearBtn');
  const jurDropdownSelectedText = document.getElementById('jurDropdownSelectedText');

  const projectCatList = document.getElementById('projectCatList');

  // Filter bar selectors
  const decisionSearchInput = document.getElementById('decisionSearchInput');
  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const clearDateBtn = document.getElementById('clearDateBtn');

  // Document Table elements
  const documentsBody = document.getElementById('documentsBody');
  const resultsMeta = document.getElementById('resultsMeta');
  const pagination = document.getElementById('pagination');
  const thDocDate = document.getElementById('th-doc-date');
  const docSortArrow = document.getElementById('docSortArrow');

  // Closed sessions table elements
  const incameraBody = document.getElementById('incameraBody');

  const jurisdictionProjects = {
    "Mid-Island Region": [
      "Buller Street City Hall", "440 First Ave(Islander Hotel)", "Machine Shop Heritage Hub",
      "Banbury Place Supportive Housing", "Regional Modernized OCP(MOCP)", "Lakes Road Rezoning", "Ladysmith Primary Modular Capital"
    ],
    "Town of Ladysmith": [
      "Buller Street City Hall", "440 First Ave(Islander Hotel)", "Machine Shop Heritage Hub", "Banbury Place Supportive Housing"
    ],
    "City of Rossland": [
      "Rossland Midtown P3 City Hall", "Columbia Avenue Infrastructure", "Star Gulch Dam Safety", "Rossland OCP Bylaw 2774"
    ],
    "District of North Cowichan": [
      "Lakes Road Rezoning(Oak & Vine)", "Utility Rates & Fees Bylaw 3888", "Municipal Forest Reserve Management"
    ],
    "Cowichan Valley Regional District": [
      "Regional Modernized OCP(MOCP Bylaw 4444)", "CVRD Solid Waste Strategy", "Shawnigan Basin Watershed Management"
    ],
    "School District 68": [
      "Ladysmith Primary Modular Expansion", "SD68 Capital Plan & Catchment Reviews"
    ],
    "Stz'uminus First Nation": [
      "SFN Waterfront Infrastructure", "SFN Joint Economic Agreements"
    ]
  };

  // 1. Setup Controllers for popup menus
  let docJurController, docAppJurController, docTypeController;
  let incameraJurController, incameraStatutoryController, incameraAttendeesController, incameraRecordTypeController;

  // Sidebar category change checkbox triggers
  const catCheckboxes = document.querySelectorAll('.cat-checkbox');
  catCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      selectedCategories = Array.from(document.querySelectorAll('.cat-checkbox:checked')).map(c => c.value);
      updateActiveCategoryBanner();
      currentPage = 1;
      loadDocuments();
      if (document.querySelector('.tab-btn.active').getAttribute('data-tab') === 'tab-incamera') {
        applyIncameraFilters();
      }
    });
  });

  function updateSidebarProjects() {
    if (!projectCatList) return;
    projectCatList.innerHTML = '';
    selectedJurs.forEach(jur => {
      const projects = jurisdictionProjects[jur] || [];
      if (projects.length === 0) return;

      const heading = document.createElement('div');
      heading.className = 'sidebar-label';
      heading.style.marginTop = '14px';
      heading.style.marginBottom = '6px';
      heading.innerText = jur;
      projectCatList.appendChild(heading);

      projects.forEach(pName => {
        const label = document.createElement('label');
        label.className = 'nav-item';
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '8px';
        label.style.cursor = 'pointer';
        const isChecked = selectedProjects.includes(pName);
        label.innerHTML = `<input type="checkbox" value="${pName}" class="proj-checkbox" ${isChecked ? 'checked' : ''} style="cursor:pointer;"> <span>${pName}</span>`;

        const checkbox = label.querySelector('input');
        checkbox.addEventListener('change', () => {
          const checkedProj = Array.from(projectCatList.querySelectorAll('.proj-checkbox:checked')).map(cb => cb.value);
          selectedProjects = checkedProj;
          updateActiveCategoryBanner();
          currentPage = 1;
          loadDocuments();
          if (document.querySelector('.tab-btn.active').getAttribute('data-tab') === 'tab-incamera') {
            applyIncameraFilters();
          }
        });
        projectCatList.appendChild(label);
      });
    });
  }

  function updateActiveCategoryBanner() {
    renderActiveFilters();
  }

  // Multi-select menu helper
  function setupMultiSelectPopup(config) {
    const { headerBtn, menu, searchInput, applyBtn, clearBtn, checkboxList, getOptions, onApply } = config;
    if (!headerBtn) return null;
    if (headerBtn.dataset.popupBound) return null;
    headerBtn.dataset.popupBound = "true";

    let selectedItems = [];

    function renderList(filterText = '') {
      if (!checkboxList) return;
      checkboxList.innerHTML = '';
      const fText = filterText.toLowerCase();
      const options = getOptions();
      options.forEach(opt => {
        if (fText && !opt.toLowerCase().includes(fText)) return;
        const isChecked = selectedItems.includes(opt);
        const label = document.createElement('label');
        label.className = 'dropdown-option';
        label.innerHTML = `<input type="checkbox" value="${opt}" ${isChecked ? 'checked' : ''}> <span>${opt}</span>`;
        checkboxList.appendChild(label);
      });
    }

    if (headerBtn && menu) {
      headerBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isHidden = menu.style.display === 'none' || menu.style.display === '';
        document.querySelectorAll('.custom-dropdown .dropdown-menu').forEach(m => m.style.display = 'none');
        menu.style.display = isHidden ? 'flex' : 'none';
        menu.style.flexDirection = 'column';
        if (isHidden) renderList();
      });
    }

    if (searchInput) {
      searchInput.onkeyup = () => renderList(searchInput.value);
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        selectedItems = [];
        if (checkboxList) {
          checkboxList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        onApply([]);
        if (menu) menu.style.display = 'none';
      };
    }

    if (applyBtn) {
      applyBtn.onclick = () => {
        if (checkboxList) {
          const allOpts = getOptions();
          const checked = Array.from(checkboxList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
          if (checked.length === allOpts.length || checked.length === 0) {
            selectedItems = [];
          } else {
            selectedItems = checked;
          }
          onApply(selectedItems);
        }
        if (menu) menu.style.display = 'none';
      };
    }

    return {
      setSelected: (items) => {
        selectedItems = items;
      }
    };
  }

  // Tab Buttons Handling
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(targetTab).classList.add('active');
      
      if (targetTab === 'tab-incamera') {
        loadInCamera();
      } else {
        loadDocuments();
      }
    });
  });

  // Text and Date inputs
  if (decisionSearchInput) {
    decisionSearchInput.addEventListener('input', () => {
      updateResetFiltersBtnVisibility();
      if (document.querySelector('.tab-btn.active').getAttribute('data-tab') === 'tab-incamera') {
        applyIncameraFilters();
      } else {
        currentPage = 1;
        loadDocuments();
      }
    });
  }

  [dateStart, dateEnd].forEach(input => {
    if (input) {
      input.addEventListener('change', () => {
        updateResetFiltersBtnVisibility();
        if (document.querySelector('.tab-btn.active').getAttribute('data-tab') === 'tab-incamera') {
          applyIncameraFilters();
        } else {
          currentPage = 1;
          loadDocuments();
        }
      });
    }
  });

  const unknownDateFilterSelect = document.getElementById('unknownDateFilterSelect');
  if (unknownDateFilterSelect) {
    unknownDateFilterSelect.addEventListener('change', () => {
      updateResetFiltersBtnVisibility();
      if (document.querySelector('.tab-btn.active').getAttribute('data-tab') === 'tab-incamera') {
        applyIncameraFilters();
      } else {
        applyDocumentFiltersAndRender();
      }
    });
  }

  // Clear Date Reset Button Click Listener
  if (clearDateBtn) {
    clearDateBtn.style.display = 'inline-block';
    clearDateBtn.disabled = true;
    clearDateBtn.addEventListener('click', () => {
      console.log("Starting reset filters sequence...");
      if (decisionSearchInput) decisionSearchInput.value = '';
      if (dateStart) dateStart.value = '';
      if (dateEnd) dateEnd.value = '';
      if (unknownDateFilterSelect) unknownDateFilterSelect.value = 'ALL';

      selectedMemberFilter = '';

      selectedDocJurList = [];
      selectedDocAppJurList = [];
      selectedDocTagsList = [];
      selectedDocTypeList = [];

      selectedIncameraJurList = [];
      selectedIncameraTypeList = [];
      selectedStatutoryList = [];
      selectedAttendeesList = [];

      document.querySelectorAll('.dropdown-options input[type="checkbox"]').forEach(cb => cb.checked = false);

      // Programmatically reset multiselect popup closures
      if (docJurController) docJurController.setSelected([]);
      if (docAppJurController) docAppJurController.setSelected([]);
      if (docTypeController) docTypeController.setSelected([]);
      if (incameraJurController) incameraJurController.setSelected([]);
      if (incameraStatutoryController) incameraStatutoryController.setSelected([]);
      if (incameraAttendeesController) incameraAttendeesController.setSelected([]);
      if (incameraRecordTypeController) incameraRecordTypeController.setSelected([]);

      const docJurText = document.getElementById('docJurText');
      if (docJurText) docJurText.innerText = 'Issuing Jurisdiction';
      const docAppJurText = document.getElementById('docAppJurText');
      if (docAppJurText) docAppJurText.innerText = 'Applicable Jurisdictions';
      const docTypeText = document.getElementById('docTypeText');
      if (docTypeText) docTypeText.innerText = 'Document Type';

      const incameraJurText = document.getElementById('incameraJurText');
      if (incameraJurText) incameraJurText.innerText = 'Jurisdiction';
      const incameraStatutoryText = document.getElementById('incameraStatutoryText');
      if (incameraStatutoryText) incameraStatutoryText.innerText = 'Statutory Grounds';
      const incameraAttendeesText = document.getElementById('incameraAttendeesText');
      if (incameraAttendeesText) incameraAttendeesText.innerText = 'Attendees';
      const incameraRecordTypeText = document.getElementById('incameraRecordTypeText');
      if (incameraRecordTypeText) incameraRecordTypeText.innerText = 'Record Type';

      updateResetFiltersBtnVisibility();
      currentPage = 1;
      loadDocuments();
      applyIncameraFilters();
      console.log("Reset filters successfully completed!");
    });
  }

  // Clear All Filters (Selected Collections) Button click listener
  const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
  if (clearAllFiltersBtn) {
    clearAllFiltersBtn.onclick = () => {
      selectedCategories = [];
      selectedProjects = [];
      document.querySelectorAll('.cat-checkbox, .proj-checkbox').forEach(cb => cb.checked = false);
      renderActiveFilters();
      currentPage = 1;
      loadDocuments();
      if (document.querySelector('.tab-btn.active').getAttribute('data-tab') === 'tab-incamera') {
        applyIncameraFilters();
      }
    };
  }

  function updateResetFiltersBtnVisibility() {
    const hasFilters = !!((decisionSearchInput && decisionSearchInput.value) ||
      (dateStart && dateStart.value) ||
      (dateEnd && dateEnd.value) ||
      (unknownDateFilterSelect && unknownDateFilterSelect.value !== 'ALL') ||
      selectedDocJurList.length > 0 ||
      selectedDocAppJurList.length > 0 ||
      selectedDocTagsList.length > 0 ||
      selectedDocTypeList.length > 0 ||
      selectedIncameraJurList.length > 0 ||
      selectedStatutoryList.length > 0 ||
      selectedAttendeesList.length > 0 ||
      selectedMemberFilter !== '');

    if (clearDateBtn) {
      clearDateBtn.style.display = 'inline-block';
      clearDateBtn.disabled = !hasFilters;
    }
  }

  // Dynamic document loader with local JSON fallback
  function loadDocuments() {
    if (documentsBody) {
      documentsBody.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">Loading documents...</div>';
    }
    const q = decisionSearchInput ? decisionSearchInput.value.trim() : '';
    let apiJur = selectedJurs.length === 5 ? 'Mid-Island Region' : (selectedJurs.length === 1 ? selectedJurs[0] : '');
    let apiCat = selectedCategories.length === 1 && selectedProjects.length === 0 ? selectedCategories[0] : (selectedCategories.length === 0 && selectedProjects.length === 1 ? selectedProjects[0] : '');

    fetch(`/api/documents?q=${encodeURIComponent(q)}&cat=${encodeURIComponent(apiCat)}&jur=${encodeURIComponent(apiJur)}&page=${currentPage}`)
      .then(res => res.json())
      .then(data => {
        rawDocumentsData = data.documents || [];
        processAndRenderDocs(data.total, data.page);
      })
      .catch(err => {
        console.warn("Backend server offline. Automatically loading local JSON fallback dataset...");
        fetch('./data/ladysmith_documents.json')
          .then(res => res.json())
          .then(data => {
            rawDocumentsData = data.documents || [];
            processAndRenderDocs(rawDocumentsData.length, 1);
          })
          .catch(localErr => {
            console.error("Critical Error: Failed to load local JSON fallback data!", localErr);
            if (documentsBody) {
              documentsBody.innerHTML = '<div style="padding:16px; text-align:center; color:#991b1b;">Failed to load documents dataset.</div>';
            }
          });
      });
  }

  function processAndRenderDocs(total, page) {
    const jurSet = new Set();
    const appJurSet = new Set();
    const docTypeSet = new Set();

    rawDocumentsData.forEach(d => {
      if (d.jurisdiction) jurSet.add(d.jurisdiction);
      if (d.applicable_jurisdictions) {
        d.applicable_jurisdictions.split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed) appJurSet.add(trimmed);
        });
      }
      docTypeSet.add(getDocType(d.title));
    });

    docJurController = setupMultiSelectPopup({
      headerBtn: document.getElementById('docJurTrigger'),
      menu: document.getElementById('docJurMenu'),
      searchInput: document.getElementById('docJurSearch'),
      applyBtn: document.getElementById('docJurApply'),
      clearBtn: document.getElementById('docJurClear'),
      checkboxList: document.getElementById('docJurOptions'),
      getOptions: () => Array.from(jurSet),
      onApply: (selected) => {
        selectedDocJurList = selected;
        const trigger = document.getElementById('docJurText');
        if (trigger) trigger.innerText = selected.length > 0 ? `Selected (${selected.length})` : 'Issuing Jurisdiction';
        updateResetFiltersBtnVisibility();
        applyDocumentFiltersAndRender();
      }
    });

    docAppJurController = setupMultiSelectPopup({
      headerBtn: document.getElementById('docAppJurTrigger'),
      menu: document.getElementById('docAppJurMenu'),
      searchInput: document.getElementById('docAppJurSearch'),
      applyBtn: document.getElementById('docAppJurApply'),
      clearBtn: document.getElementById('docAppJurClear'),
      checkboxList: document.getElementById('docAppJurOptions'),
      getOptions: () => Array.from(appJurSet),
      onApply: (selected) => {
        selectedDocAppJurList = selected;
        const trigger = document.getElementById('docAppJurText');
        if (trigger) trigger.innerText = selected.length > 0 ? `Selected (${selected.length})` : 'Applicable Jurisdictions';
        updateResetFiltersBtnVisibility();
        applyDocumentFiltersAndRender();
      }
    });

    docTypeController = setupMultiSelectPopup({
      headerBtn: document.getElementById('docTypeTrigger'),
      menu: document.getElementById('docTypeMenu'),
      searchInput: document.getElementById('docTypeSearch'),
      applyBtn: document.getElementById('docTypeApply'),
      clearBtn: document.getElementById('docTypeClear'),
      checkboxList: document.getElementById('docTypeOptions'),
      getOptions: () => Array.from(docTypeSet),
      onApply: (selected) => {
        selectedDocTypeList = selected;
        const trigger = document.getElementById('docTypeText');
        if (trigger) trigger.innerText = selected.length > 0 ? `Selected (${selected.length})` : 'Document Type';
        updateResetFiltersBtnVisibility();
        applyDocumentFiltersAndRender();
      }
    });

    if (resultsMeta) {
      resultsMeta.innerText = `Found ${total} verified records matching criteria.`;
    }

    applyDocumentFiltersAndRender();
    renderPagination(total, page);
  }

  function applyDocumentFiltersAndRender() {
    let docs = [...rawDocumentsData];

    if (selectedDocJurList.length > 0) {
      docs = docs.filter(d => selectedDocJurList.includes(d.jurisdiction));
    }

    const allFilters = [...selectedCategories, ...selectedProjects];
    if (allFilters.length > 0) {
      docs = docs.filter(d => {
        const docBlob = `${d.title || ''} ${d.category || ''} ${d.project_category || ''} ${d.snippet || ''}`.toLowerCase();
        return allFilters.some(f => docBlob.includes(f.toLowerCase()));
      });
    }

    if (selectedDocAppJurList.length > 0) {
      docs = docs.filter(d => {
        if (!d.applicable_jurisdictions) return false;
        const docAppJurs = d.applicable_jurisdictions.split(',').map(item => item.trim());
        return docAppJurs.some(aj => selectedDocAppJurList.includes(aj));
      });
    }

    if (selectedDocTypeList.length > 0) {
      docs = docs.filter(d => selectedDocTypeList.includes(getDocType(d.title)));
    }

    const dStart = dateStart ? dateStart.value : '';
    const dEnd = dateEnd ? dateEnd.value : '';
    const uOpt = unknownDateFilterSelect ? unknownDateFilterSelect.value : 'ALL';

    docs = docs.filter(d => {
      const rawDate = d.date || '';
      const isUnknown = !rawDate || rawDate.toLowerCase() === 'historical record' || rawDate.toLowerCase() === 'unknown';
      if (uOpt === 'HIDE' && isUnknown) return false;
      if (uOpt === 'ONLY' && isUnknown) return true;
      if (uOpt === 'ONLY' && !isUnknown) return false;

      if (!isUnknown) {
        let matchStart = !dStart || rawDate >= dStart;
        let matchEnd = !dEnd || rawDate <= dEnd;
        return matchStart && matchEnd;
      } else if (dStart || dEnd) {
        return uOpt === 'ONLY';
      }
      return true;
    });

    const docSortSelect = document.getElementById('docSortSelect');
    const sortVal = docSortSelect ? docSortSelect.value : 'date-desc';
    const q = decisionSearchInput ? decisionSearchInput.value.trim() : '';

    if (sortVal === 'date-asc') {
      docs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } else if (sortVal === 'date-desc') {
      docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else if (sortVal === 'relevance') {
      docs.sort((a, b) => getRelevanceScore(b, q) - getRelevanceScore(a, q));
    }

    filteredDocumentsList = docs;
    renderDocTable(docs);
    renderActiveFilters();
  }

  function renderDocTable(docs) {
    if (!documentsBody) return;
    documentsBody.innerHTML = '';

    if (docs.length === 0) {
      documentsBody.innerHTML = '<div style="padding:24px; text-align:center; color:var(--text-muted); font-weight:500;">No records found matching filter criteria.</div>';
      return;
    }

    const q = decisionSearchInput ? decisionSearchInput.value.trim() : '';

    docs.forEach(d => {
      const highlightedTitle = highlightKeywords(d.title || '', q);
      const localBackupUrl = `/api/view-document?title=${encodeURIComponent(d.title || '')}`;

      const docLink = `<a class="link-slate-bold" href="${localBackupUrl}" target="_blank" style="text-decoration:none; color:var(--bc-blue); font-size:1.1rem; font-weight:700;" title="Click to view local HTML backup of this document">${highlightedTitle}</a>`;

      const externalLinkBtn = d.url
        ? `<a href="${d.url}" target="_blank" class="pill pill-grey" style="text-decoration:none; margin-left: 12px; font-size:0.75rem; display:inline-block;" title="Open original website link">View Document ↗</a>`
        : '';

      const highlightedSnippet = highlightKeywords(d.snippet || '', q);
      const snippetDisplay = d.snippet
        ? `<p class="doc-snippet" style="margin: 10px 0; font-size: 0.88rem; line-height: 1.5; color: var(--text);">${highlightedSnippet}...</p>`
        : '<p class="doc-snippet" style="margin: 10px 0; font-size: 0.88rem; line-height: 1.5; color: var(--text-muted);">No preview text available.</p>';

      const docType = getDocType(d.title);
      const dateFormatted = isDateValid(d.date) ? d.date : 'Unknown Date';

      const card = document.createElement('div');
      card.className = 'doc-card';
      card.style.background = 'white';
      card.style.border = '1px solid var(--border)';
      card.style.borderRadius = '8px';
      card.style.padding = '18px';
      card.style.marginBottom = '16px';
      card.style.boxShadow = 'var(--shadow)';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '6px';
      card.style.textAlign = 'left';
      card.style.overflow = 'hidden';

      const tags = d.category ? d.category.split(',').map(t => t.trim()).filter(Boolean) : [];
      const tagsHtml = tags.map(tag => `<span class="pill pill-grey clickable-category-tag" data-tag="${tag}" style="cursor:pointer; margin-right:4px; margin-bottom:4px; display:inline-block; font-size: 11px;">${highlightKeywords(tag, q)}</span>`).join('');

      const footerHtml = tags.length > 0
        ? `<div class="doc-footer" style="margin-top: 8px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 6px; text-align: left;">
             <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
               <span style="font-weight: 600; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Categories:</span>
               ${tagsHtml}
             </div>
           </div>`
        : '';

      card.innerHTML = `
        <div class="doc-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.78rem; background: #e2e8f0; border-bottom: 1px solid #cbd5e1; margin: -18px -18px 10px -18px; padding: 10px 18px;">
          <div>
            <span class="doc-jur" style="font-weight: 700; color: var(--bc-blue); margin-right: 12px; font-size: 0.82rem;">${highlightKeywords(d.jurisdiction || '', q)}</span>
            <span style="color: #64748b; font-weight: 600; font-size: 0.78rem;">${highlightKeywords(d.applicable_jurisdictions || '', q)}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 4px 0 2px 0;">
          <h4 class="doc-title" style="margin: 0; display: inline-block;">${docLink}</h4>
          ${externalLinkBtn}
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px; margin-top: 2px; margin-bottom: 8px;">
          <span>📅 ${dateFormatted}</span>
          <span>•</span>
          <span>${docType}</span>
        </div>
        ${snippetDisplay}
        ${footerHtml}
      `;

      card.querySelectorAll('.clickable-category-tag').forEach(tagEl => {
        tagEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const clickedTag = tagEl.getAttribute('data-tag');
          const cb = Array.from(document.querySelectorAll('.cat-checkbox')).find(el => el.value === clickedTag);
          if (cb) {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
          }
        });
      });

      documentsBody.appendChild(card);
    });
  }

  // Render Dynamic Active Filter Pills (Perfect visual matches)
  function renderActiveFilters() {
    const container = document.getElementById('activeFiltersContainer');
    const bar = document.getElementById('activeFiltersBar');
    if (!container || !bar) return;
    container.innerHTML = '';
    const pills = [];

    // 1. Sidebar Category checkboxes
    selectedCategories.forEach(cat => {
      pills.push({
        label: `Category: ${cat}`,
        onClear: () => {
          const cb = Array.from(document.querySelectorAll('.cat-checkbox')).find(el => el.value === cat);
          if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
        }
      });
    });

    // 2. Sidebar Projects checkboxes
    selectedProjects.forEach(proj => {
      pills.push({
        label: `Project: ${proj}`,
        onClear: () => {
          const cb = Array.from(document.querySelectorAll('.proj-checkbox')).find(el => el.value === proj);
          if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
        }
      });
    });

    // 3. Document/Closed Session/Date Filters have been decoupled from the Selected Collections bar and do not render pills here.

    // Render HTML components for active pills
    if (pills.length > 0) {
      bar.style.display = 'flex';
      pills.forEach(p => {
        const pillEl = document.createElement('div');
        pillEl.className = 'active-filter-pill';
        pillEl.innerHTML = `<span>${p.label}</span><span class="clear-x">✕</span>`;
        pillEl.addEventListener('click', (e) => {
          e.stopPropagation();
          p.onClear();
        });
        container.appendChild(pillEl);
      });
    } else {
      bar.style.display = 'none';
    }
  }

  function renderPagination(total, page) {
    if (!pagination) return;
    pagination.innerHTML = '';
    const totalPages = Math.ceil(total / 25);
    if (totalPages <= 1) return;

    for (let i = 1; i <= Math.min(totalPages, 10); i++) {
      const pBtn = document.createElement('button');
      pBtn.className = i === page ? 'active' : '';
      pBtn.innerText = i;
      pBtn.addEventListener('click', () => {
        currentPage = i;
        loadDocuments();
      });
      pagination.appendChild(pBtn);
    }
  }

  // --- CLOSED SESSIONS FUNCTIONS ---
  function loadInCamera() {
    if (incameraBody) {
      incameraBody.innerHTML = '<tr><td colspan="8" style="padding:16px; text-align:center; color:var(--text-muted);">Loading closed sessions...</td></tr>';
    }
    fetch('/api/incamera')
      .then(res => res.json())
      .then(data => {
        rawIncameraData = data.incamera || [];
        processAndRenderIncamera();
      })
      .catch(err => {
        console.warn("Backend closed session API offline. Automatically loading local JSON fallback dataset...");
        fetch('./data/ladysmith_incamera.json')
          .then(res => res.json())
          .then(data => {
            rawIncameraData = data.items || data.incamera || [];
            processAndRenderIncamera();
          })
          .catch(localErr => {
            console.error("Critical Error: Failed to load closed session local fallback!", localErr);
            if (incameraBody) {
              incameraBody.innerHTML = '<tr><td colspan="8" style="padding:16px; text-align:center; color:#991b1b;">Failed to load closed session dataset.</td></tr>';
            }
          });
      });
  }

  function processAndRenderIncamera() {
    const jurs = new Set();
    const statutorySet = new Set();
    const attendeesSet = new Set();

    rawIncameraData.forEach(item => {
      if (item.jurisdiction) jurs.add(item.jurisdiction);
      if (item.topic) statutorySet.add(item.topic);
    });

    const sampleAttendees = ["Salient Group", "Robert Fung", "Young Anderson Barristers", "Ryan Bouma", "Guillermo Ferrero"];
    sampleAttendees.forEach(att => attendeesSet.add(att));

    incameraJurController = setupMultiSelectPopup({
      headerBtn: document.getElementById('incameraJurTrigger'),
      menu: document.getElementById('incameraJurMenu'),
      searchInput: document.getElementById('incameraJurSearch'),
      applyBtn: document.getElementById('incameraJurApply'),
      clearBtn: document.getElementById('incameraJurClear'),
      checkboxList: document.getElementById('incameraJurOptions'),
      getOptions: () => Array.from(jurs),
      onApply: (selected) => {
        selectedIncameraJurList = selected;
        document.getElementById('incameraJurText').innerText = selected.length > 0 ? `Selected (${selected.length})` : `Jurisdiction`;
        updateResetFiltersBtnVisibility();
        applyIncameraFilters();
      }
    });

    incameraStatutoryController = setupMultiSelectPopup({
      headerBtn: document.getElementById('incameraStatutoryTrigger'),
      menu: document.getElementById('incameraStatutoryMenu'),
      searchInput: document.getElementById('incameraStatutorySearch'),
      applyBtn: document.getElementById('incameraStatutoryApply'),
      clearBtn: document.getElementById('incameraStatutoryClear'),
      checkboxList: document.getElementById('incameraStatutoryOptions'),
      getOptions: () => Array.from(statutorySet),
      onApply: (selected) => {
        selectedStatutoryList = selected;
        document.getElementById('incameraStatutoryText').innerText = selected.length > 0 ? `Selected (${selected.length})` : `Statutory Grounds`;
        updateResetFiltersBtnVisibility();
        applyIncameraFilters();
      }
    });

    incameraAttendeesController = setupMultiSelectPopup({
      headerBtn: document.getElementById('incameraAttendeesTrigger'),
      menu: document.getElementById('incameraAttendeesMenu'),
      searchInput: document.getElementById('incameraAttendeesSearch'),
      applyBtn: document.getElementById('incameraAttendeesApply'),
      clearBtn: document.getElementById('incameraAttendeesClear'),
      checkboxList: document.getElementById('incameraAttendeesOptions'),
      getOptions: () => Array.from(attendeesSet),
      onApply: (selected) => {
        selectedAttendeesList = selected;
        document.getElementById('incameraAttendeesText').innerText = selected.length > 0 ? `Selected (${selected.length})` : `Attendees`;
        updateResetFiltersBtnVisibility();
        applyIncameraFilters();
      }
    });

    incameraRecordTypeController = setupMultiSelectPopup({
      headerBtn: document.getElementById('incameraRecordTypeTrigger'),
      menu: document.getElementById('incameraRecordTypeMenu'),
      searchInput: document.getElementById('incameraRecordTypeSearch'),
      applyBtn: document.getElementById('incameraRecordTypeApply'),
      clearBtn: document.getElementById('incameraRecordTypeClear'),
      checkboxList: document.getElementById('incameraRecordTypeOptions'),
      getOptions: () => ['Closed Minutes', 'Closed Agenda', 'Closed Notice', 'Rise and Report'],
      onApply: (selected) => {
        selectedIncameraTypeList = selected;
        document.getElementById('incameraRecordTypeText').innerText = selected.length > 0 ? `Selected (${selected.length})` : `Record Type`;
        updateResetFiltersBtnVisibility();
        applyIncameraFilters();
      }
    });

    const headIncameraStatusSelect = document.getElementById('headIncameraStatusSelect');
    if (headIncameraStatusSelect) {
      headIncameraStatusSelect.onchange = applyIncameraFilters;
    }

    const thIncameraDate = document.getElementById('thIncameraDate');
    if (thIncameraDate) {
      thIncameraDate.onclick = () => {
        incameraDateAsc = !incameraDateAsc;
        const arrow = document.getElementById('sortIncameraArrow');
        if (arrow) arrow.innerText = incameraDateAsc ? '▴' : '▾';
        applyIncameraFilters();
      };
    }

    applyIncameraFilters();
  }

  function applyIncameraFilters() {
    const qVal = decisionSearchInput ? decisionSearchInput.value.trim().toLowerCase() : '';
    const sVal = dateStart ? dateStart.value : '';
    const eVal = dateEnd ? dateEnd.value : '';
    const stVal = document.getElementById('headIncameraStatusSelect') ? document.getElementById('headIncameraStatusSelect').value : '';

    let filtered = rawIncameraData.filter(item => {
      let matchText = true;
      if (qVal) {
        const blob = `${item.title || ''} ${item.topic || ''} ${item.snippet || ''} ${item.jurisdiction || ''}`.toLowerCase();
        matchText = blob.includes(qVal);
      }

      const rawDate = item.date || '';
      const isUnknown = !rawDate || rawDate.toLowerCase() === 'historical record' || rawDate.toLowerCase() === 'unknown';
      const uOpt = unknownDateFilterSelect ? unknownDateFilterSelect.value : 'ALL';

      if (uOpt === 'HIDE' && isUnknown) return false;
      if (uOpt === 'ONLY' && isUnknown) return true;
      if (uOpt === 'ONLY' && !isUnknown) return false;

      let matchDate = true;
      if (!isUnknown) {
        let matchStart = !sVal || rawDate >= sVal;
        let matchEnd = !eVal || rawDate <= eVal;
        matchDate = matchStart && matchEnd;
      } else if (sVal || eVal) {
        matchDate = uOpt === 'ONLY';
      }

      let matchJur = true;
      if (selectedIncameraJurList.length > 0) {
        matchJur = selectedIncameraJurList.includes(item.jurisdiction);
      }

      let matchStatus = true;
      if (stVal === "RISEN") matchStatus = item.status.includes("Risen");
      if (stVal === "CONFIDENTIAL") matchStatus = item.status.includes("Unreported") || item.status.includes("Confidential");

      let matchType = true;
      if (selectedIncameraTypeList.length > 0) {
        matchType = selectedIncameraTypeList.some(t => {
          const lowerTitle = (item.title || '').toLowerCase();
          const lowerT = t.toLowerCase();
          if (lowerT === "rise and report") {
            return lowerTitle.includes("rise") || lowerTitle.includes("report");
          }
          if (lowerT === "closed minutes") return lowerTitle.includes("minutes");
          if (lowerT === "closed") return lowerTitle.includes("notice") || lowerTitle.includes("agenda") || lowerTitle.includes("minutes");
          return lowerTitle.includes(lowerT);
        });
      }

      let matchCat = true;
      const allFilters = [...selectedCategories, ...selectedProjects];
      if (allFilters.length > 0) {
        const cBlob = `${item.title || ''} ${item.topic || ''} ${item.snippet || ''}`.toLowerCase();
        matchCat = allFilters.some(f => cBlob.includes(f.toLowerCase()));
      }

      let matchStatutory = true;
      if (selectedStatutoryList.length > 0) {
        matchStatutory = selectedStatutoryList.includes(item.topic);
      }

      let matchAttendee = true;
      if (selectedAttendeesList.length > 0) {
        const rowAttendeesBlob = (item.attendees || "Salient Group, Robert Fung, Young Anderson Barristers").toLowerCase();
        matchAttendee = selectedAttendeesList.some(att => rowAttendeesBlob.includes(att.toLowerCase()));
      }

      return matchText && matchCat && matchDate && matchJur && matchStatus && matchType && matchStatutory && matchAttendee;
    });

    filtered.sort((a, b) => {
      const dA = a.date || '';
      const dB = b.date || '';
      return incameraDateAsc ? dA.localeCompare(dB) : dB.localeCompare(dA);
    });

    filteredIncameraList = filtered;
    renderIncameraTable(filtered);
    renderActiveFilters();
  }

  function renderIncameraTable(items) {
    if (!incameraBody) return;
    incameraBody.innerHTML = '';

    if (items.length === 0) {
      incameraBody.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">No closed-session records found matching selected criteria.</div>';
      return;
    }

    const q = decisionSearchInput ? decisionSearchInput.value.trim().toLowerCase() : '';

    items.forEach(row => {
      const card = document.createElement('div');
      card.className = 'closed-card';

      const isRisen = row.status.includes("Risen");
      const statusBadge = isRisen
        ? '<span class="pill pill-green" style="background:#065f46; color:#a7f3d0; border-color:#047857;" title="Publicly released under Rise & Report procedures">🔓 Risen & Reported</span>'
        : '<span class="pill pill-red" style="background:#991b1b; color:#fecaca; border-color:#b91c1c;" title="Under FIPPA restrictions">🔒 Unreported (Confidential)</span>';

      const jurDisplay = `<span style="font-weight: 700; color: #38bdf8;">${highlightKeywords(row.jurisdiction || '', q)}</span>`;

      let justificationBadge = '<span class="pill pill-grey" style="background:#334155; color:#cbd5e1; border-color:#475569;">S. 90(1)(g) Legal Advice</span>';
      let generalDesc = 'Litigation & developer agreements';

      const titleLower = (row.title || '').toLowerCase();
      const snippetLower = (row.snippet || '').toLowerCase();
      const combinedBlob = titleLower + ' ' + snippetLower;

      if (combinedBlob.includes('land') || combinedBlob.includes('remediation') || combinedBlob.includes('zoning') || combinedBlob.includes('property') || combinedBlob.includes('real estate')) {
        justificationBadge = '<span class="pill pill-grey" style="background:#334155; color:#cbd5e1; border-color:#475569;">S. 90(1)(e) Land Acquisition</span>';
        generalDesc = 'Property negotiations & valuation';
      } else if (combinedBlob.includes('recruitment') || combinedBlob.includes('governance') || combinedBlob.includes('personnel') || combinedBlob.includes('labour') || combinedBlob.includes('officer')) {
        justificationBadge = '<span class="pill pill-grey" style="background:#334155; color:#cbd5e1; border-color:#475569;">S. 90(1)(c) Labour Relations</span>';
        generalDesc = 'Officer recruitment & personnel';
      } else if (combinedBlob.includes('water') || combinedBlob.includes('utilities') || combinedBlob.includes('contract') || combinedBlob.includes('tender')) {
        justificationBadge = '<span class="pill pill-grey" style="background:#334155; color:#cbd5e1; border-color:#475569;">S. 90(1)(k) Municipal Service</span>';
        generalDesc = 'Negotiations & service contracts';
      }

      const displayDate = (!row.date || row.date.toLowerCase() === 'historical record' || row.date.toLowerCase() === 'unknown')
        ? '<span class="text-muted">Unknown Date</span>'
        : row.date;

      // Dynamic attendee loops
      let rowAttendeesList = ["Salient Group", "Robert Fung", "Young Anderson Barristers"];
      if (row.attendees) {
        if (Array.isArray(row.attendees)) {
          rowAttendeesList = row.attendees;
        } else if (typeof row.attendees === 'string' && row.attendees.trim()) {
          rowAttendeesList = row.attendees.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        }
      }
      const attendeesHtml = rowAttendeesList.map(member => {
        const isActive = selectedAttendeesList.includes(member) || selectedMemberFilter === member;
        const styleStr = isActive ? 'outline: 2px solid #38bdf8; font-weight:700;' : '';
        return `<span class="link-blue click-member-filter" data-member="${member}" style="cursor:pointer; color:#38bdf8; text-decoration:underline; font-size:0.82rem; ${styleStr}">${member}</span>`;
      }).join(', ');

      const recordTypeDisplay = row.title.includes("Minutes") ? "Closed Minutes" : (row.title.includes("Agenda") ? "Closed Agenda" : "Closed Notice");

      card.innerHTML = `
        <div class="closed-card-header">
          <div>
            ${jurDisplay}
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${displayDate}</div>
          </div>
          <div>${statusBadge}</div>
        </div>
        <div style="margin-bottom: 8px;">
          <a href="${row.url || '#'}" target="_blank" class="closed-card-title">${highlightKeywords(row.title || '', q)}</a>
        </div>
        <div class="closed-card-metadata">
          <span>📁 ${recordTypeDisplay}</span>
          <span>🆔 CE-${row.id}</span>
        </div>
        <div class="closed-card-body">
          <div style="margin-bottom: 8px;">
            ${justificationBadge}
          </div>
          <p style="margin: 0; font-size: 0.85rem; color: #94a3b8; font-style: italic;">Topic: ${generalDesc}</p>
          ${row.snippet ? `<p style="margin: 8px 0 0 0; font-size: 0.88rem; line-height: 1.5; color: #cbd5e1;">${highlightKeywords(row.snippet, q)}</p>` : ''}
        </div>
        <div class="closed-card-footer">
          <span style="color:#94a3b8; font-weight:600;">Attendees:</span>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">${attendeesHtml}</div>
        </div>
      `;

      // Bind member filtering on dynamically rendered click-member-filter pills
      card.querySelectorAll('.click-member-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetMember = btn.getAttribute('data-member');
          if (selectedMemberFilter === targetMember) {
            selectedMemberFilter = '';
          } else {
            selectedMemberFilter = targetMember;
          }
          applyIncameraFilters();
        });
      });

      incameraBody.appendChild(card);
    });
  }

  // Helper functions
  function isDateValid(str) {
    if (!str) return false;
    const reg = /^\d{4}-\d{2}-\d{2}$/;
    if (!reg.test(str)) return false;
    const year = parseInt(str.substring(0, 4));
    return year >= 1800 && year <= 2100;
  }

  function getDocType(title) {
    const lower = (title || '').toLowerCase();
    if (lower.includes('minutes')) return '📋 Minutes';
    if (lower.includes('agenda')) return '📅 Agenda';
    if (lower.includes('notice')) return '🔔 Notice';
    if (lower.includes('bylaw')) return '📜 Bylaw';
    if (lower.includes('policy')) return '🛡️ Policy';
    if (lower.includes('report')) return '📊 Report';
    if (lower.includes('agreement')) return '🤝 Agreement';
    if (lower.includes('profile')) return '👤 Profile';
    if (lower.includes('brochure') || lower.includes('guide')) return '📖 Guide';
    return '📄 Document';
  }

  function getRelevanceScore(doc, query) {
    if (!query) return 0;
    const lowerQ = query.toLowerCase();
    let score = 0;
    if ((doc.title || '').toLowerCase().includes(lowerQ)) score += 10;
    if ((doc.snippet || '').toLowerCase().includes(lowerQ)) score += 2;
    if ((doc.jurisdiction || '').toLowerCase().includes(lowerQ)) score += 5;
    if ((doc.applicable_jurisdictions || '').toLowerCase().includes(lowerQ)) score += 3;
    return score;
  }

  function highlightKeywords(text, keyword) {
    if (!keyword || !text) return text;
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark style="background-color: #fef08a; color: #000; font-weight: bold; border-radius: 2px; padding: 0 2px;">$1</mark>');
  }

  // Initial runs
  updateSidebarProjects();
  loadDocuments();
  updateResetFiltersBtnVisibility();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
