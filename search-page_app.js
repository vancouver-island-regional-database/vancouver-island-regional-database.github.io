

function initApp() {
  let currentPage = 1;
  let selectedJurs = ["Town of Ladysmith"];

  let rawIncameraData = [];
  let rawDocumentsData = [];

  let filteredDocumentsList = [];
  let filteredIncameraList = [];

  let incameraDateAsc = false;
  let docDateAsc = false;
  let userSetSort = false;

  let selectedDocJurList = [];
  let selectedDocAppJurList = [];
  let selectedDocTagsList = [];
  let selectedDocTypeList = [];
  let selectedLinkStatusList = [];

  let selectedIncameraJurList = [];
  let selectedIncameraTypeList = [];
  let selectedStatutoryList = [];
  let selectedAttendeesList = [];

  let selectedCategories = [];
  let selectedProjects = [];
  let selectedMemberFilter = '';

  let searchDbInstance = null;
  let searchDbLoadingPromise = null;
  let searchDbLoadFailed = false;
  let currentFtsSnippets = null;
  let currentFtsTiers = null;

  function showSearchDbLoadingBanner(show, failed) {
    let banner = document.getElementById('ftsLoadingBanner');
    if (!show) {
      if (banner) banner.remove();
      return;
    }
    const anchor = document.getElementById('documentsBody');
    if (!anchor) return;
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'ftsLoadingBanner';
      banner.style.cssText = 'padding:12px 16px; margin-bottom:12px; border-radius:6px; font-size:0.85rem; font-weight:600;';
      anchor.parentNode.insertBefore(banner, anchor);
    }
    if (failed) {
      banner.style.background = '#fef2f2';
      banner.style.color = '#991b1b';
      banner.innerText = 'Full-text search index failed to load -- showing basic title/summary matches only.';
    } else {
      banner.style.background = '#eff6ff';
      banner.style.color = 'var(--bc-blue)';
      banner.innerText = 'The first time you use the search engine there will be a slight delay while the full index content loads (~94MB)... results below are basic title/summary matches until this finishes.';
    }
  }

  function ensureSearchDbLoaded() {
    if (searchDbInstance) return Promise.resolve(searchDbInstance);
    if (searchDbLoadingPromise) return searchDbLoadingPromise;

    showSearchDbLoadingBanner(true);
    searchDbLoadingPromise = (async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js-fts5@1.4.0/dist/${file}`
        });
        const resp = await fetch('https://vancouver-island-regional-database.github.io/document-index/site-data/ladysmith_search.db.gz');
        if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
        const compressedBuf = await resp.arrayBuffer();
        const decompressedStream = new Blob([compressedBuf]).stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressedBuf = await new Response(decompressedStream).arrayBuffer();
        searchDbInstance = new SQL.Database(new Uint8Array(decompressedBuf));
        showSearchDbLoadingBanner(false);
        return searchDbInstance;
      } catch (err) {
        console.error('Failed to load full-text search database:', err);
        searchDbLoadFailed = true;
        showSearchDbLoadingBanner(true, true);
        return null;
      }
    })();
    return searchDbLoadingPromise;
  }

  function buildFtsQueryCandidates(rawQuery) {
    const hasAdvancedSyntax = /"/.test(rawQuery) || /\bOR\b/.test(rawQuery) || /\bNOT\b/.test(rawQuery);
    if (hasAdvancedSyntax) {
      const quoteCount = (rawQuery.match(/"/g) || []).length;
      return [quoteCount % 2 === 1 ? rawQuery + '"' : rawQuery];
    }
    const tokens = rawQuery
      .split(/\s+/)
      .map(t => t.replace(/[^\p{L}\p{N}]+/gu, ''))
      .filter(Boolean);
    if (tokens.length === 0) return [];
    if (tokens.length === 1) {
      return [`${tokens[0]}*`];
    }
    const quoted = tokens.map(t => `"${t}"`);
    const candidates = [];
    candidates.push(`"${tokens.slice(0, -1).join(' ')} ${tokens[tokens.length - 1]}*"`);
    candidates.push(`NEAR(${quoted.join(' ')}, 5)`);
    candidates.push(tokens.map(t => `${t}*`).join(' '));
    return candidates;
  }

  const SNIPPET_MARK_START = '\uE000';
  const SNIPPET_MARK_END = '\uE001';

  function runFtsQuery(ftsQuery) {
    const stmt = searchDbInstance.prepare(
      `SELECT document_id, snippet(documents_fts, -1, '${SNIPPET_MARK_START}', '${SNIPPET_MARK_END}', '…', 24) AS snip ` +
      "FROM documents_fts WHERE documents_fts MATCH ? ORDER BY rank"
    );
    stmt.bind([ftsQuery]);
    const results = new Map();
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.set(row.document_id, row.snip || '');
    }
    stmt.free();
    return results;
  }

  function ftsSearch(query) {
    if (!searchDbInstance || !query) return null;
    const candidates = buildFtsQueryCandidates(query);
    if (candidates.length === 0) return null;
    const merged = new Map();
    let anySucceeded = false;
    candidates.forEach((ftsQuery, tierIdx) => {
      const tier = tierIdx + 1;
      try {
        const tierResults = runFtsQuery(ftsQuery);
        anySucceeded = true;
        tierResults.forEach((snip, docId) => {
          const existing = merged.get(docId);
          if (!existing || tier < existing.tier) {
            merged.set(docId, { snippet: snip, tier });
          }
        });
      } catch (err) {
        console.error('FTS query failed:', err, 'built query was:', ftsQuery);
      }
    });
    return anySucceeded ? merged : null;
  }

  const PROJECT_ADDITIVE_JUR = {
    "City Hall Redevelopment": { jurisdiction: "City of Rossland", dataFile: "https://vancouver-island-regional-database.github.io/document-index/site-data/rossland_documents.json" }
  };
  let cachedAdditiveData = {}; // { "City of Rossland": [...] }

  function getActiveAdditiveJurisdictions() {
    return selectedProjects
      .map(p => PROJECT_ADDITIVE_JUR[p])
      .filter(Boolean);
  }

  function ensureAdditiveDataLoaded() {
    const active = getActiveAdditiveJurisdictions();
    const toFetch = active.filter(a => !cachedAdditiveData[a.jurisdiction]);
    if (toFetch.length === 0) return Promise.resolve();
    return Promise.all(toFetch.map(a =>
      fetch(a.dataFile)
        .then(res => res.json())
        .then(data => { cachedAdditiveData[a.jurisdiction] = data.documents || []; })
        .catch(err => {
          console.error(`Failed to load additive dataset for ${a.jurisdiction}`, err);
          cachedAdditiveData[a.jurisdiction] = [];
        })
    ));
  }

  const jurDropdownTrigger = document.getElementById('jurDropdownTrigger');
  const jurDropdownMenu = document.getElementById('jurDropdownMenu');
  const jurSearchInput = document.getElementById('jurSearchInput');
  const jurApplyBtn = document.getElementById('jurApplyBtn');
  const jurClearBtn = document.getElementById('jurClearBtn');
  const jurDropdownSelectedText = document.getElementById('jurDropdownSelectedText');

  const projectCatList = document.getElementById('projectCatList');

  const decisionSearchInput = document.getElementById('decisionSearchInput');
  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const clearDateBtn = document.getElementById('clearDateBtn');

  const documentsBody = document.getElementById('documentsBody');
  const resultsMeta = document.getElementById('resultsMeta');
  const pagination = document.getElementById('pagination');
  const thDocDate = document.getElementById('th-doc-date');
  const docSortArrow = document.getElementById('docSortArrow');

  const incameraBody = document.getElementById('incameraBody');

  const jurisdictionProjects = {
    "Mid-Island Region": [
      "City Hall Redevelopment", "Islander Hotel", "Machine Shop Lease",
      "Heart on the Hill", "Regional Modernized OCP(MOCP)", "Lakes Road Rezoning", "Ladysmith Primary Modular Capital"
    ],
    "Town of Ladysmith": [
      "City Hall Redevelopment", "Islander Hotel", "Machine Shop Lease", "Heart on the Hill"
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

  let docJurController, docAppJurController, docTypeController, linkStatusController;
  let incameraJurController, incameraStatutoryController, incameraAttendeesController, incameraRecordTypeController;

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

  function setupMultiSelectPopup(config) {
    const { headerBtn, menu, searchInput, applyBtn, clearBtn, checkboxList, getOptions, onApply, colorMap, labelMap } = config;
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
        // Same pattern as the category checkboxes (.cat-checkbox): the
        // checkbox itself gets a colored border/fill via a CSS custom
        // property, not a separate swatch element next to it.
        const colorAttr = colorMap && colorMap[opt] ? ` class="jur-checkbox" style="--jur-color:${colorMap[opt]}"` : '';
        const displayText = labelMap && labelMap[opt] ? labelMap[opt] : opt;
        label.innerHTML = `<input type="checkbox" value="${opt}"${colorAttr} ${isChecked ? 'checked' : ''}> <span>${displayText}</span>`;
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
          if (checked.length === 0) {
            selectedItems = [];
          } else if (allOpts.length > 1 && checked.length === allOpts.length) {
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

  if (decisionSearchInput) {
    if (documentsBody) {
      const filterBar = decisionSearchInput.closest('.date-filter-bar') || decisionSearchInput.parentNode;
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:0.75rem; color:var(--text-muted); flex-basis:100%; width:100%; margin-top:8px;';
      hint.innerText = 'Tip: search first tries to match your words near each other, then falls back to matching them anywhere in the document. Use "quotes" for an exact phrase, or OR between words for either.';
      filterBar.appendChild(hint);
    }
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

  const docSortSelectEl = document.getElementById('docSortSelect');
  if (docSortSelectEl) {
    docSortSelectEl.addEventListener('change', () => {
      userSetSort = true;
      applyDocumentFiltersAndRender();
    });
  }

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
      selectedLinkStatusList = [];

      selectedIncameraJurList = [];
      selectedIncameraTypeList = [];
      selectedStatutoryList = [];
      selectedAttendeesList = [];

      document.querySelectorAll('.dropdown-options input[type="checkbox"]').forEach(cb => cb.checked = false);

      if (docJurController) docJurController.setSelected([]);
      if (docAppJurController) docAppJurController.setSelected([]);
      if (docTypeController) docTypeController.setSelected([]);
      if (linkStatusController) linkStatusController.setSelected([]);
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
      const linkStatusText = document.getElementById('linkStatusText');
      if (linkStatusText) linkStatusText.innerText = 'Link Status';

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
      selectedLinkStatusList.length > 0 ||
      selectedIncameraJurList.length > 0 ||
      selectedStatutoryList.length > 0 ||
      selectedAttendeesList.length > 0 ||
      selectedMemberFilter !== '');

    if (clearDateBtn) {
      clearDateBtn.style.display = 'inline-block';
      clearDateBtn.disabled = !hasFilters;
    }
  }

  function loadDocuments() {
    if (documentsBody) {
      documentsBody.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">Loading documents...</div>';
    }
    const q = decisionSearchInput ? decisionSearchInput.value.trim() : '';
    let apiJur = selectedJurs.length === 5 ? 'Mid-Island Region' : (selectedJurs.length === 1 ? selectedJurs[0] : '');
    let apiCat = selectedCategories.length === 1 && selectedProjects.length === 0 ? selectedCategories[0] : (selectedCategories.length === 0 && selectedProjects.length === 1 ? selectedProjects[0] : '');

    // window.LOCAL_DB_FILTER is set only by the local-only bootstrap script
    // (see local-bootstrap.js), when the Database sidebar radio is present --
    // always undefined/'' on the public site, so this is a no-op there.
    const dbFilter = (typeof window !== 'undefined' && window.LOCAL_DB_FILTER) || '';
    fetch(`/api/documents?q=${encodeURIComponent(q)}&cat=${encodeURIComponent(apiCat)}&jur=${encodeURIComponent(apiJur)}&db=${encodeURIComponent(dbFilter)}&page=${currentPage}`)
      .then(res => res.json())
      .then(data => {
        rawDocumentsData = data.documents || [];
        finishLoadingDocuments(data.total, data.page);
      })
      .catch(err => {
        console.warn("Backend server offline. Automatically loading local JSON fallback dataset...");
        fetch('https://vancouver-island-regional-database.github.io/document-index/site-data/ladysmith_documents.json')
          .then(res => res.json())
          .then(data => {
            rawDocumentsData = data.documents || [];
            finishLoadingDocuments(rawDocumentsData.length, 1);
          })
          .catch(localErr => {
            console.error("Critical Error: Failed to load local JSON fallback data!", localErr);
            if (documentsBody) {
              documentsBody.innerHTML = '<div style="padding:16px; text-align:center; color:#991b1b;">Failed to load documents dataset.</div>';
            }
          });
      });
  }

  function finishLoadingDocuments(total, page) {
    const active = getActiveAdditiveJurisdictions();
    if (active.length === 0) {
      processAndRenderDocs(total, page);
      return;
    }
    ensureAdditiveDataLoaded().then(() => {
      active.forEach(a => {
        rawDocumentsData = [...rawDocumentsData, ...(cachedAdditiveData[a.jurisdiction] || [])];
      });
      processAndRenderDocs(rawDocumentsData.length, page);
    });
  }

  function getLiveJurisdictionOptions() {
    return Array.from(new Set(rawDocumentsData.map(d => d.jurisdiction).filter(Boolean)));
  }
  function getLiveAppJurisdictionOptions() {
    const s = new Set();
    rawDocumentsData.forEach(d => {
      if (d.applicable_jurisdictions) {
        d.applicable_jurisdictions.split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed) s.add(trimmed);
        });
      }
    });
    return Array.from(s);
  }
  function getLiveDocTypeOptions() {
    return Array.from(new Set(rawDocumentsData.map(d => getDocTypeLabel(d))));
  }

  function getLiveIncameraJurOptions() {
    return Array.from(new Set(rawIncameraData.map(i => i.jurisdiction).filter(Boolean)));
  }
  function getLiveIncameraStatutoryOptions() {
    return Array.from(new Set(rawIncameraData.map(i => i.topic).filter(Boolean)));
  }
  function getLiveIncameraAttendeeOptions() {
    const s = new Set();
    rawIncameraData.forEach(item => {
      (Array.isArray(item.attendees) ? item.attendees : []).forEach(a => {
        const name = String(a || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (name) s.add(name);
      });
    });
    return Array.from(s).sort();
  }

  function processAndRenderDocs(total, page) {
    docJurController = setupMultiSelectPopup({
      headerBtn: document.getElementById('docJurTrigger'),
      menu: document.getElementById('docJurMenu'),
      searchInput: document.getElementById('docJurSearch'),
      applyBtn: document.getElementById('docJurApply'),
      clearBtn: document.getElementById('docJurClear'),
      checkboxList: document.getElementById('docJurOptions'),
      getOptions: getLiveJurisdictionOptions,
      colorMap: JURISDICTION_COLORS,
      onApply: (selected) => {
        selectedDocJurList = selected;
        const trigger = document.getElementById('docJurText');
        if (trigger) trigger.innerText = selected.length > 0 ? `Selected (${selected.length})` : 'Issuing Jurisdiction';
        updateResetFiltersBtnVisibility();
        applyDocumentFiltersAndRender();
      }
    });
    if (docJurController) {
      docJurController.setSelected(["Town of Ladysmith"]);
      selectedDocJurList = ["Town of Ladysmith"];
      const jurTrigger = document.getElementById('docJurText');
      if (jurTrigger) jurTrigger.innerText = 'Selected (1)';
    }

    docAppJurController = setupMultiSelectPopup({
      headerBtn: document.getElementById('docAppJurTrigger'),
      menu: document.getElementById('docAppJurMenu'),
      searchInput: document.getElementById('docAppJurSearch'),
      applyBtn: document.getElementById('docAppJurApply'),
      clearBtn: document.getElementById('docAppJurClear'),
      checkboxList: document.getElementById('docAppJurOptions'),
      getOptions: getLiveAppJurisdictionOptions,
      colorMap: JURISDICTION_COLORS,
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
      getOptions: getLiveDocTypeOptions,
      onApply: (selected) => {
        selectedDocTypeList = selected;
        const trigger = document.getElementById('docTypeText');
        if (trigger) trigger.innerText = selected.length > 0 ? `Selected (${selected.length})` : 'Document Type';
        updateResetFiltersBtnVisibility();
        applyDocumentFiltersAndRender();
      }
    });

    linkStatusController = setupMultiSelectPopup({
      headerBtn: document.getElementById('linkStatusTrigger'),
      menu: document.getElementById('linkStatusMenu'),
      applyBtn: document.getElementById('linkStatusApply'),
      clearBtn: document.getElementById('linkStatusClear'),
      checkboxList: document.getElementById('linkStatusOptions'),
      getOptions: getLiveLinkStatusOptions,
      labelMap: Object.fromEntries(Object.entries(LINK_STATUS_META).map(([k, v]) => [k, v.text])),
      onApply: (selected) => {
        selectedLinkStatusList = selected;
        const trigger = document.getElementById('linkStatusText');
        if (trigger) trigger.innerText = selected.length > 0 ? `Selected (${selected.length})` : 'Link Status';
        updateResetFiltersBtnVisibility();
        applyDocumentFiltersAndRender();
      }
    });

    applyDocumentFiltersAndRender();
  }

  function getLiveLinkStatusOptions() {
    return Array.from(new Set(rawDocumentsData.map(d => d.link_status_code || 'unchecked').filter(Boolean)));
  }

  function applyDocumentFiltersAndRender() {
    let docs = [...rawDocumentsData];

    const searchQ = decisionSearchInput ? decisionSearchInput.value.trim() : '';
    currentFtsSnippets = null;
    currentFtsTiers = null;
    if (searchQ) {
      if (!searchDbInstance && !searchDbLoadFailed) {
        ensureSearchDbLoaded().then(db => {
          if (db) applyDocumentFiltersAndRender();
        });
      }

      const ftsResults = ftsSearch(searchQ);
      if (ftsResults) {
        docs = docs.filter(d => ftsResults.has(d.id));
        currentFtsSnippets = new Map();
        currentFtsTiers = new Map();
        ftsResults.forEach((val, docId) => {
          currentFtsSnippets.set(docId, val.snippet);
          currentFtsTiers.set(docId, val.tier);
        });
      } else {
        const qWords = searchQ.toLowerCase().split(/\s+/).filter(Boolean);
        docs = docs.filter(d => {
          const blob = `${d.title || ''} ${d.jurisdiction || ''} ${d.applicable_jurisdictions || ''} ${d.category || ''} ${d.project_category || ''} ${d.snippet || ''}`.toLowerCase();
          return qWords.every(w => blob.includes(w));
        });
      }
    } else {
      showSearchDbLoadingBanner(false);
    }

    if (selectedDocJurList.length > 0) {
      docs = docs.filter(d => selectedDocJurList.includes(d.jurisdiction));
    }

    const allFilters = [...selectedCategories, ...selectedProjects];
    const additiveJurNames = getActiveAdditiveJurisdictions().map(a => a.jurisdiction);
    if (allFilters.length > 0) {
      docs = docs.filter(d => {
        if (additiveJurNames.includes(d.jurisdiction)) return true;
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
      docs = docs.filter(d => selectedDocTypeList.includes(getDocTypeLabel(d)));
    }

    if (selectedLinkStatusList.length > 0) {
      docs = docs.filter(d => selectedLinkStatusList.includes(d.link_status_code || 'unchecked'));
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
    const q = decisionSearchInput ? decisionSearchInput.value.trim() : '';

    let sortVal = docSortSelect ? docSortSelect.value : 'date-desc';
    if (q && !userSetSort) {
      sortVal = 'relevance';
      if (docSortSelect) docSortSelect.value = 'relevance';
    }

    if (sortVal === 'date-asc') {
      docs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } else if (sortVal === 'date-desc') {
      docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else if (sortVal === 'relevance') {
      docs.sort((a, b) => getRelevanceScore(b, q) - getRelevanceScore(a, q));
    }

    filteredDocumentsList = docs;
    const PAGE_SIZE = 25;
    const totalFiltered = docs.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageDocs = docs.slice(startIdx, startIdx + PAGE_SIZE);

    if (resultsMeta) {
      resultsMeta.innerText = `Found ${totalFiltered} verified records matching criteria.`;
    }

    renderDocTable(pageDocs);
    renderPagination(totalFiltered, currentPage);
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
      const displayTitleRaw = d.display_title || d.title || '';
      const highlightedTitle = highlightKeywords(displayTitleRaw, q);

      const linkStatus = d.link_status_code || 'unchecked';
      const isLinkBroken = linkStatus !== '200' && linkStatus !== 'unchecked';

      const backupLinkBtn = d.html_file_path
        ? (isLinkBroken
            ? `<a href="${d.html_file_path}" target="_blank" style="font-size:.7rem; color:#C5221F; font-weight:700; text-decoration:underline;" title="View local HTML backup of this document">Link broken? view html backup</a>`
            : `<a href="${d.html_file_path}" target="_blank" style="font-size:.64rem; color:#94A3B8; font-weight:400; text-decoration:underline;" title="View local HTML backup of this document">Link broken? view html backup</a>`)
        : '';

      const altUrlLinks = (Array.isArray(d.alternate_urls) && d.alternate_urls.length)
        ? d.alternate_urls.map((u, i) => `<a href="${u}" target="_blank" style="font-size:.64rem; color:#94A3B8; font-weight:400; text-decoration:underline;" title="Additional source URL for this document">alternate source${d.alternate_urls.length > 1 ? ' ' + (i + 1) : ''}</a>`).join(' &middot; ')
        : '';

      const ftsSnip = currentFtsSnippets && currentFtsSnippets.get(d.id);
      let snippetDisplay;
      if (ftsSnip) {
        const escaped = escapeHtml(ftsSnip);
        const marked = escaped.split(SNIPPET_MARK_START).join('<mark style="background-color: #fef08a; color: #000; font-weight: bold; border-radius: 2px; padding: 0 2px;">').split(SNIPPET_MARK_END).join('</mark>');
        snippetDisplay = `<p class="doc-snippet" style="margin: 10px 0; font-size: 0.88rem; line-height: 1.5; color: var(--text);">${marked}</p>`;
      } else if (d.snippet) {
        const highlightedSnippet = highlightKeywords(d.snippet, q);
        snippetDisplay = `<p class="doc-snippet" style="margin: 10px 0; font-size: 0.88rem; line-height: 1.5; color: var(--text);">${highlightedSnippet}...</p>`;
      } else {
        snippetDisplay = '<p class="doc-snippet" style="margin: 10px 0; font-size: 0.88rem; line-height: 1.5; color: var(--text-muted);">No preview text available.</p>';
      }

      const docTypeLabel = getDocTypeLabel(d);
      const docTypePill = `<span class="pill ${getDocTypePillClass(docTypeLabel)} clickable-doctype-pill" data-doctype="${escapeHtml(docTypeLabel)}" title="Filter by this document type" style="cursor:pointer; font-size:10.5px; padding:2px 8px;">${escapeHtml(docTypeLabel)}</span>`;
      const dateFormatted = !isDateValid(d.date)
        ? 'Date not recorded'
        : isFullDate(d.date) ? d.date : `${d.date} (year only)`;

      const card = document.createElement('div');
      card.className = 'doc-card';
      // d.is_public is only ever false when talking to the local server with
      // private records included -- undefined on the public site (which never
      // returns the field), so this attribute is a no-op there. Actual dark
      // styling lives in local-overrides.css, not here.
      if (d.is_public === false) card.setAttribute('data-private', 'true');
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
      // Categories (Water Systems, Infrastructure & Services, etc.) aren't
      // jurisdiction-specific -- display just the category name, but keep the
      // full "Jurisdiction: Category" in data-tag since that's what matching
      // logic elsewhere still expects. Same pill as before, just its own
      // border bumped from 1px to 2px and colored per category.
      const tagsHtml = tags.map(tag => {
        const displayTag = tag.includes(': ') ? tag.split(': ').slice(1).join(': ') : tag;
        const catColor = CATEGORY_OUTLINE_COLORS[displayTag] || '#94a3b8';
        return `<span class="pill pill-grey clickable-category-tag" data-tag="${tag}" style="cursor:pointer; margin-right:4px; margin-bottom:4px; display:inline-block; font-size: 11px; border:1px solid ${catColor};">${highlightKeywords(displayTag, q)}</span>`;
      }).join('');

      const footerHtml = tags.length > 0
        ? `<div class="doc-footer" style="margin-top: 8px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 6px; text-align: left;">
             <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
               <span style="font-weight: 600; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Categories:</span>
               ${tagsHtml}
             </div>
           </div>`
        : '';

      const jurColor = JURISDICTION_COLORS[d.jurisdiction] || DEFAULT_JUR_COLOR;
      const jurIconSrc = JURISDICTION_ICONS[d.jurisdiction];
      const jurIcon = jurIconSrc
        ? `<span class="icon-container"><img src="${jurIconSrc}" alt="${escapeHtml(d.jurisdiction || '')} icon"></span>`
        : '';
      const strikeStyle = isLinkBroken ? ' text-decoration:line-through;' : '';
      const docLink = d.url
        ? `<a class="link-slate-bold" href="${d.url}" target="_blank" style="text-decoration:none;${strikeStyle} color:var(--bc-blue); font-size:1.1rem; font-weight:700;" title="Open original source">${highlightedTitle}</a>`
        : `<span class="link-slate-bold" style="color:var(--text); font-size:1.1rem; font-weight:700;${strikeStyle}" title="No original source link recorded">${highlightedTitle}</span>`;

      const statusPill = LINK_STATUS_META[linkStatus] || LINK_STATUS_META['200'];
      const statusTooltip = d.link_checked_date
        ? `Checked ${d.link_checked_date}: ${statusPill.label}`
        : statusPill.label;
      const statusBadge = `<span class="status-badge ${statusPill.cls} has-tooltip clickable-status-badge" data-tooltip="${escapeHtml(statusTooltip)}" data-status="${escapeHtml(linkStatus)}" style="cursor:pointer;">${statusPill.text}</span>`;

      card.innerHTML = `
        <div class="doc-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 0.78rem; background: ${jurColor}; margin: -18px -18px 10px -18px; padding: 10px 18px;">
          <div>
            <span class="doc-jur" style="font-weight: 700; color: #fff; font-size: 0.82rem;">${jurIcon}${highlightKeywords(d.jurisdiction || '', q)}</span>
            ${d.applicable_jurisdictions ? `<span style="color: rgba(255,255,255,0.75); font-weight: 400; font-size: 0.74rem; margin-left: 12px;">${highlightKeywords(d.applicable_jurisdictions, q)}</span>` : ''}
          </div>
          ${statusBadge}
        </div>
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 4px 0 2px 0;">
          <h4 class="doc-title" style="margin: 0; display: inline-block;">${docLink}</h4>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px; margin-top: 2px; margin-bottom: 8px;">
          <span>📅 ${dateFormatted}</span>
          <span>•</span>
          <span title="Which website this document was retrieved from">🌐 ${d.source || 'Unknown'}</span>
          <span>•</span>
          ${docTypePill}
          ${backupLinkBtn ? `<span>•</span><span>${backupLinkBtn}</span>` : ''}
          ${altUrlLinks ? `<span>•</span><span>${altUrlLinks}</span>` : ''}
        </div>
        ${snippetDisplay}
        ${footerHtml}
      `;

      card.querySelectorAll('.clickable-category-tag').forEach(tagEl => {
        tagEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const clickedTag = tagEl.getAttribute('data-tag');
          // Card tags carry a "Jurisdiction: " prefix (e.g. "Town of Ladysmith:
          // Infrastructure & Services"), but the sidebar checkboxes only store
          // the bare category name -- strip the prefix before matching.
          const bareTag = clickedTag.includes(': ') ? clickedTag.split(': ').slice(1).join(': ') : clickedTag;
          const cb = Array.from(document.querySelectorAll('.cat-checkbox')).find(el => el.value === bareTag);
          if (cb) {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
          }
        });
      });

      card.querySelectorAll('.clickable-doctype-pill').forEach(pillEl => {
        pillEl.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleDocTypeFilter(pillEl.getAttribute('data-doctype'));
        });
      });

      card.querySelectorAll('.clickable-status-badge').forEach(badgeEl => {
        badgeEl.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleLinkStatusFilter(badgeEl.getAttribute('data-status'));
        });
      });

      documentsBody.appendChild(card);
    });
  }

  function renderActiveFilters() {
    const container = document.getElementById('activeFiltersContainer');
    const bar = document.getElementById('activeFiltersBar');
    if (!container || !bar) return;
    container.innerHTML = '';
    const pills = [];

    selectedCategories.forEach(cat => {
      pills.push({
        label: `Category: ${cat}`,
        onClear: () => {
          const cb = Array.from(document.querySelectorAll('.cat-checkbox')).find(el => el.value === cat);
          if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
        }
      });
    });

    selectedProjects.forEach(proj => {
      pills.push({
        label: `Project: ${proj}`,
        onClear: () => {
          const cb = Array.from(document.querySelectorAll('.proj-checkbox')).find(el => el.value === proj);
          if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
        }
      });
    });

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
        applyDocumentFiltersAndRender();
      });
      pagination.appendChild(pBtn);
    }
  }

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
        fetch('https://vancouver-island-regional-database.github.io/document-index/site-data/ladysmith_incamera.json')
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
    incameraJurController = setupMultiSelectPopup({
      headerBtn: document.getElementById('incameraJurTrigger'),
      menu: document.getElementById('incameraJurMenu'),
      searchInput: document.getElementById('incameraJurSearch'),
      applyBtn: document.getElementById('incameraJurApply'),
      clearBtn: document.getElementById('incameraJurClear'),
      checkboxList: document.getElementById('incameraJurOptions'),
      getOptions: getLiveIncameraJurOptions,
      colorMap: JURISDICTION_COLORS,
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
      getOptions: getLiveIncameraStatutoryOptions,
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
      getOptions: getLiveIncameraAttendeeOptions,
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
      const attendeesBlobStr = (Array.isArray(item.attendees) ? item.attendees.join(' ') : '');

      let matchText = true;
      if (qVal) {
        const blob = `${item.title || ''} ${item.topic || ''} ${item.snippet || ''} ${item.jurisdiction || ''} ${attendeesBlobStr}`.toLowerCase();
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

      const itemStatus = item.status || '';
      let matchStatus = true;
      if (stVal === "RISEN") matchStatus = itemStatus.includes("Risen");
      if (stVal === "CONFIDENTIAL") matchStatus = itemStatus.includes("Unreported") || itemStatus.includes("Confidential");

      let matchType = true;
      if (selectedIncameraTypeList.length > 0) {
        matchType = selectedIncameraTypeList.some(t => {
          const lowerTitle = (item.title || '').toLowerCase();
          const lowerStatus = (item.status || '').toLowerCase();
          const lowerT = t.toLowerCase();
          if (lowerT === "rise and report") return lowerStatus.includes('risen');
          if (lowerT === "closed minutes") return lowerTitle.includes("minutes");
          if (lowerT === "closed agenda") return lowerTitle.includes("agenda");
          if (lowerT === "closed notice") return lowerTitle.includes("notice");
          return lowerTitle.includes(lowerT);
        });
      }

      let matchCat = true;
      const allFilters = [...selectedCategories, ...selectedProjects];
      if (allFilters.length > 0) {
        const cBlob = `${item.title || ''} ${item.topic || ''} ${item.snippet || ''} ${attendeesBlobStr}`.toLowerCase();
        matchCat = allFilters.some(f => cBlob.includes(f.toLowerCase()));
      }

      let matchStatutory = true;
      if (selectedStatutoryList.length > 0) {
        matchStatutory = selectedStatutoryList.includes(item.topic);
      }

      let matchAttendee = true;
      if (selectedAttendeesList.length > 0) {
        const rowAttendeesBlob = attendeesBlobStr.toLowerCase();
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
        ? '<span class="text-muted">Date not recorded</span>'
        : isFullDate(row.date) ? row.date : `${row.date} (year only)`;

      let rowAttendeesList = [];
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
          <a href="${row.url || '#'}" target="_blank" class="closed-card-title" title="Open original source">${highlightKeywords(row.display_title || row.title || '', q)}</a>
        </div>
        <div class="closed-card-metadata">
          <span>📁 ${recordTypeDisplay}</span>
          <span>🆔 CE-${row.id}</span>
          <span title="Which website this record was retrieved from">🌐 ${row.source || 'Unknown'}</span>
          ${row.html_file_path ? `<span><a href="${row.html_file_path}" target="_blank" style="font-size:.64rem; color:#94A3B8; font-weight:400; text-decoration:underline;" title="View local HTML backup of this document">Link broken? view html backup</a></span>` : ''}
          ${Array.isArray(row.alternate_urls) && row.alternate_urls.length ? `<span>${row.alternate_urls.map((u, i) => `<a href="${u}" target="_blank" style="font-size:.64rem; color:#94A3B8; font-weight:400; text-decoration:underline;" title="Additional source URL for this document">alternate source${row.alternate_urls.length > 1 ? ' ' + (i + 1) : ''}</a>`).join(' &middot; ')}</span>` : ''}
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

  function isDateValid(str) {
    if (!str) return false;
    const fullReg = /^\d{4}-\d{2}-\d{2}$/;
    const yearOnlyReg = /^\d{4}$/;
    if (!fullReg.test(str) && !yearOnlyReg.test(str)) return false;
    const year = parseInt(str.substring(0, 4));
    return year >= 1800 && year <= 2100;
  }

  // True only for a full YYYY-MM-DD date (used to decide whether a specific
  // day is known, vs. a year-only recovered date from isDateValid()).
  function isFullDate(str) {
    return !!str && /^\d{4}-\d{2}-\d{2}$/.test(str);
  }

  // Pill color grouping for document_type -- reuses the site's existing pill-*
  // classes (same ones used for category tags) rather than emoji, so type is
  // signaled by color/label instead of an icon that reads as generic AI output.
  // Ungrouped/unrecognized types fall through to pill-grey.
  const DOC_TYPE_PILL_GROUPS = {
    'pill-grey': ['Minutes', 'Agenda', 'Bylaw', 'Staff Report to Council', 'Report'],
    'pill-blue': ['Correspondence', 'Correspondence from the Public', 'Intergovernmental Correspondence', 'Agreement/Contract'],
    'pill-green': ['Financial/Budget', 'Tender/RFP', 'Permit/License', 'Application/Form'],
    'pill-dark-green': ['Plan/Strategy', 'Policy', 'Terms of Reference', 'Map/GIS'],
    'pill-orange': ['Public Notice/Communication', 'Schedule/Notice', 'Job Posting'],
    'pill-purple': ['FAQ/Info Sheet', 'Presentation', 'Survey', 'Award/Recognition', 'Public Information/Miscellaneous']
  };
  const DOC_TYPE_TO_PILL = {};
  Object.entries(DOC_TYPE_PILL_GROUPS).forEach(([pillClass, types]) => {
    types.forEach(t => { DOC_TYPE_TO_PILL[t] = pillClass; });
  });

  // Legacy fallback for records with no document_type set (e.g. other
  // jurisdictions not yet run through the type revamp) -- same categories,
  // no emoji, so the fallback path matches the primary path visually.
  function legacyDocTypeGuess(title) {
    const lower = (title || '').toLowerCase();
    if (lower.includes('minutes')) return 'Minutes';
    if (lower.includes('agenda')) return 'Agenda';
    if (lower.includes('notice')) return 'Public Notice/Communication';
    if (lower.includes('bylaw')) return 'Bylaw';
    if (lower.includes('policy')) return 'Policy';
    if (lower.includes('report')) return 'Report';
    if (lower.includes('agreement')) return 'Agreement/Contract';
    if (lower.includes('brochure') || lower.includes('guide')) return 'FAQ/Info Sheet';
    return 'Public Information/Miscellaneous';
  }

  // Single source of truth for a document's type label: prefer the real
  // document_type field (populated by the 2026-08-22 type revamp); fall back
  // to a title guess only when the field is missing.
  function getDocTypeLabel(d) {
    return (d && d.document_type) ? d.document_type : legacyDocTypeGuess(d ? d.title : '');
  }
  function getDocTypePillClass(label) {
    return DOC_TYPE_TO_PILL[label] || 'pill-grey';
  }

  // Category outline colors -- separate system from the document-type pills
  // above (those are filled; these are outline-only), so hue reuse is fine.
  const CATEGORY_OUTLINE_COLORS = {
    'Water Systems': '#93c5fd',
    'Infrastructure & Services': '#94a3b8',
    'Major Developments': '#fcd34d',
    'Land Use Planning': '#86efac',
    'Natural Resources': '#d2b48c',
    'Parks & Community Facilities': '#c4b5fd'
  };

  // Per-jurisdiction color for card headers and the jurisdiction filter
  // dropdown. Colors are dark enough (WCAG-safe) to hold white header text.
  // Canonical colors only -- confirmed by Beth, not invented. Where she gave
  // two options (a bright brand color + a darker fallback), the darker one
  // was picked wherever the bright option failed white-text contrast (WCAG
  // ~4.5:1 against white). Anything not listed falls back to
  // DEFAULT_JUR_COLOR until a real canonical color is confirmed.
  const JURISDICTION_COLORS = {
    'Town of Ladysmith': '#0885AD',
    'School District 68': '#5F7D3E',
    // North Cowichan's bright option (#E8941B) contrast-checked at ~2.4:1
    // against white -- fails. Using the navy alternative instead.
    'District of North Cowichan': '#183B50',
    // CVRD's two bright options (#25BBB9 ~2.4:1, #D0E44F far worse) both
    // fail against white -- using the dark-green fallback Beth gave.
    'Cowichan Valley Regional District': '#003403',
    // Stz'uminus' blue passes (~4.6:1) -- used as given.
    "Stz'uminus First Nation": '#3269FF',
    // Rossland: picked the darker of the two options (~14.7:1) for a safe
    // margin; the lighter option (#1C76DE) was right at the ~4.5:1 edge.
    'City of Rossland': '#062265',
    'City of Nanaimo': '#004475',
    // MoTI: Beth said "uses Gov BC styling" -- reusing the site's existing
    // BC-gov brand blue rather than inventing a MoTI-specific color.
    'Ministry of Transportation and Infrastructure': '#003366'
  };
  const DEFAULT_JUR_COLOR = '#334155';

  // Link-status pill, reusing water-systems' existing .status-badge system
  // (same CSS classes/tooltip pattern) rather than inventing a new one.
  // Data comes from Antigravity's broken-link recheck -- see
  // link_status_code / link_checked_date on each document.
  const LINK_STATUS_META = {
    '200': { cls: 'live-200', text: '✓ LIVE (200)', label: 'Live -- link resolves normally' },
    '307': { cls: 'hidden-200', text: '↪ REDIRECTED (307)', label: 'Redirected away from the original PDF' },
    '403': { cls: 'restricted-403', text: '🔒 RESTRICTED (403)', label: 'Access restricted (403 Forbidden)' },
    '404': { cls: 'absent-404', text: '✕ ABSENT (404)', label: 'Not found (404)' },
    '429': { cls: 'hidden-200', text: '⏳ RATE LIMITED (429)', label: 'Rate-limited by the source site at last check' },
    'Error': { cls: 'absent-404', text: '⚠ ERROR', label: 'Unresolved connection error at last check' },
    'unchecked': { cls: 'unchecked-pending', text: '◌ NOT YET VERIFIED', label: 'Link has not been checked yet -- status unknown' }
  };

  // Real favicon images, matching the existing icon-before-name convention
  // used elsewhere on the site (water-systems' .doc-card-footer /
  // .icon-container -- 14x14 circular image, not an emoji). Only Ladysmith
  // and SD68 have an actual icon file in assets/authority-icons/; no icon is
  // shown for jurisdictions that don't have one rather than inventing one.
  const JURISDICTION_ICONS = {
    'Town of Ladysmith': 'assets/authority-icons/fav_ladysmith_0885AD.png',
    'School District 68': 'assets/authority-icons/fav_sd68_5F7D3E.png'
  };

  // Lets a document-type pill on a card act as a shortcut into the Document
  // Type filter dropdown -- clicking it toggles that value the same way
  // checking it in the dropdown would, then re-applies filters immediately.
  function toggleDocTypeFilter(label) {
    if (!label) return;
    const idx = selectedDocTypeList.indexOf(label);
    if (idx === -1) {
      selectedDocTypeList = [...selectedDocTypeList, label];
    } else {
      selectedDocTypeList = selectedDocTypeList.filter(v => v !== label);
    }
    if (docTypeController) docTypeController.setSelected(selectedDocTypeList);
    const trigger = document.getElementById('docTypeText');
    if (trigger) trigger.innerText = selectedDocTypeList.length > 0 ? `Selected (${selectedDocTypeList.length})` : 'Document Type';
    updateResetFiltersBtnVisibility();
    applyDocumentFiltersAndRender();
  }

  function toggleLinkStatusFilter(code) {
    if (!code) return;
    const idx = selectedLinkStatusList.indexOf(code);
    if (idx === -1) {
      selectedLinkStatusList = [...selectedLinkStatusList, code];
    } else {
      selectedLinkStatusList = selectedLinkStatusList.filter(v => v !== code);
    }
    if (linkStatusController) linkStatusController.setSelected(selectedLinkStatusList);
    const trigger = document.getElementById('linkStatusText');
    if (trigger) trigger.innerText = selectedLinkStatusList.length > 0 ? `Selected (${selectedLinkStatusList.length})` : 'Link Status';
    updateResetFiltersBtnVisibility();
    applyDocumentFiltersAndRender();
  }

  function getRelevanceScore(doc, query) {
    if (!query) return 0;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;
    let score = 0;
    const title = (doc.title || '').toLowerCase();
    const snippet = (doc.snippet || '').toLowerCase();
    const jur = (doc.jurisdiction || '').toLowerCase();
    const appJur = (doc.applicable_jurisdictions || '').toLowerCase();
    words.forEach(w => {
      if (title.includes(w)) score += 10;
      if (snippet.includes(w)) score += 2;
      if (jur.includes(w)) score += 5;
      if (appJur.includes(w)) score += 3;
    });
    if (currentFtsTiers && currentFtsTiers.has(doc.id)) {
      const tier = currentFtsTiers.get(doc.id);
      score += (4 - tier) * 100; // tier 1 -> +300, tier 2 -> +200, tier 3 -> +100
    }
    return score;
  }

  function highlightKeywords(text, keyword) {
    if (!keyword || !text) return text;
    const words = keyword.split(/\s+/).filter(Boolean);
    if (words.length === 0) return text;
    const escapedWords = words.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');
    return text.replace(regex, '<mark style="background-color: #fef08a; color: #000; font-weight: bold; border-radius: 2px; padding: 0 2px;">$1</mark>');
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Exposed only so the local-only bootstrap script (see local-bootstrap.js)
  // can trigger a reload when the Database sidebar radio changes -- this
  // function is otherwise closure-private. Harmless unused global on public.
  window.__reloadDocuments = () => { currentPage = 1; loadDocuments(); };

  updateSidebarProjects();
  loadDocuments();
  updateResetFiltersBtnVisibility();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
