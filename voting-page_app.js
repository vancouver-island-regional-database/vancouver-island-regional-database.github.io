

document.addEventListener('DOMContentLoaded', () => {
  let rawDecisionsData = [];
  let selectedCategories = [];
  let selectedProjects = [];
  let selectedMemberFilter = '';
  let dateSortAsc = false;

  let headJurSelected = [];
  let headYeasSelected = [];
  let headNaysSelected = [];
  let headStatusSelected = [];

  let selectedJurs = ["Town of Ladysmith"];

  const projectCatList = document.getElementById('projectCatList');
  const decisionSearchInput = document.getElementById('decisionSearchInput');
  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const clearDateBtn = document.getElementById('clearDateBtn');
  const thDate = document.getElementById('thDate');
  const sortArrow = document.getElementById('sortArrow');

  const headRecusalSelect = document.getElementById('headRecusalSelect');

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

  let headJurController, headYeasController, headNaysController, headStatusController;

  const UNRECORDED_VALUES = ['none', 'n/a', '0', 'none specified', 'none recorded', 'not specified', 'unrecorded', '-', '', 'all council'];

  const NAME_ALIASES = {
    "robert johnson": "Rob Johnson"
  };

  function parseMemberNames(raw) {
    if (!raw) return [];
    const cleaned = raw.replace(/\b(Mayor|Councillor|Councilor|Alderman|Alderperson|Deputy Mayor)\b/gi, ',');
    return cleaned.split(/[,;]/).map(s => s.trim()).filter(s => s && !UNRECORDED_VALUES.includes(s.toLowerCase()))
      .map(s => NAME_ALIASES[s.toLowerCase()] || s);
  }

  function getAllCouncilMembers() {
    const names = new Set();
    rawDecisionsData.forEach(d => {
      parseMemberNames(d.yeas).forEach(n => names.add(n));
      parseMemberNames(d.nays).forEach(n => names.add(n));
      parseMemberNames(d.mover).forEach(n => names.add(n));
    });
    return Array.from(names).sort();
  }

  document.querySelectorAll('.cat-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      selectedCategories = Array.from(document.querySelectorAll('.cat-checkbox:checked')).map(c => c.value);
      renderActiveFilters();
      applyHeaderFilters();
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
          renderActiveFilters();
          applyHeaderFilters();
        });
        projectCatList.appendChild(label);
      });
    });
  }

  function setupTableMultiSelect(prefix, defaultText) {
    const trigger = document.getElementById(`${prefix}Trigger`);
    const menu = document.getElementById(`${prefix}Menu`);
    const applyBtn = document.getElementById(`${prefix}Apply`);
    const clearBtn = document.getElementById(`${prefix}Clear`);
    const searchInput = document.getElementById(`${prefix}Search`);
    if (!trigger || !menu) return null;

    if (trigger.dataset.popupBound) return null;
    trigger.dataset.popupBound = "true";

    trigger.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      trigger.blur();
      const isVisible = menu.style.display === 'flex' || menu.style.display === 'block';
      document.querySelectorAll('.matrix-table .dropdown-menu').forEach(m => m.style.display = 'none');
      menu.style.display = isVisible ? 'none' : 'flex';
      menu.style.flexDirection = 'column';
    });

    if (searchInput) {
      searchInput.oninput = () => {
        const query = searchInput.value.toLowerCase();
        document.querySelectorAll(`#${prefix}Options .dropdown-option`).forEach(label => {
          label.style.display = label.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
        });
      };
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        document.querySelectorAll(`#${prefix}Options input[type="checkbox"]`).forEach(cb => cb.checked = false);
        const optionEl = document.getElementById(`${prefix}Text`);
        if (prefix === 'headJur') headJurSelected = [];
        if (prefix === 'headYeas') headYeasSelected = [];
        if (prefix === 'headNays') headNaysSelected = [];
        if (prefix === 'headStatus') headStatusSelected = [];

        if (optionEl) {
          optionEl.textContent = defaultText;
        }
        menu.style.display = 'none';
        applyHeaderFilters();
        renderActiveFilters();
      };
    }

    if (applyBtn) {
      applyBtn.onclick = () => {
        const checked = Array.from(document.querySelectorAll(`#${prefix}Options input[type="checkbox"]:checked`)).map(cb => cb.value);
        const optionEl = document.getElementById(`${prefix}Text`);
        if (prefix === 'headJur') headJurSelected = checked;
        if (prefix === 'headYeas') headYeasSelected = checked;
        if (prefix === 'headNays') headNaysSelected = checked;
        if (prefix === 'headStatus') headStatusSelected = checked;

        if (optionEl) {
          optionEl.textContent = checked.length === 0 ? defaultText : `Selected (${checked.length})`;
        }
        menu.style.display = 'none';
        applyHeaderFilters();
        renderActiveFilters();
      };
    }

    return {
      setSelected: (items) => {
        document.querySelectorAll(`#${prefix}Options input[type="checkbox"]`).forEach(cb => {
          cb.checked = items.includes(cb.value);
        });
        const optionEl = document.getElementById(`${prefix}Text`);
        if (optionEl) {
          optionEl.textContent = items.length === 0 ? defaultText : `Selected (${items.length})`;
        }
        if (prefix === 'headJur') headJurSelected = items;
        if (prefix === 'headYeas') headYeasSelected = items;
        if (prefix === 'headNays') headNaysSelected = items;
        if (prefix === 'headStatus') headStatusSelected = items;
      }
    };
  }

  function renderActiveFilters() {
    const bar = document.getElementById('activeFiltersBar');
    const container = document.getElementById('activeFiltersContainer');
    if (!bar || !container) return;
    container.innerHTML = '';
    const pills = [];

    selectedCategories.forEach(cat => {
      pills.push({
        label: `Category: ${cat}`,
        onClear: () => {
          selectedCategories = selectedCategories.filter(item => item !== cat);
          const cb = Array.from(document.querySelectorAll('.cat-checkbox')).find(el => el.value === cat);
          if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
        }
      });
    });

    selectedProjects.forEach(proj => {
      pills.push({
        label: `Project: ${proj}`,
        onClear: () => {
          selectedProjects = selectedProjects.filter(item => item !== proj);
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

  if (clearDateBtn) {
    clearDateBtn.style.display = 'inline-block';
    clearDateBtn.disabled = true;
    clearDateBtn.addEventListener('click', () => {
      console.log("Initializing filter reset sequence for Voting Page...");
      if (decisionSearchInput) decisionSearchInput.value = '';
      if (dateStart) dateStart.value = '';
      if (dateEnd) dateEnd.value = '';
      
      const unknownDateSelect = document.getElementById('unknownDateFilterSelect');
      if (unknownDateSelect) unknownDateSelect.value = 'ALL';

      if (headRecusalSelect) headRecusalSelect.value = '';

      selectedMemberFilter = '';

      headJurSelected = [];
      headYeasSelected = [];
      headNaysSelected = [];
      headStatusSelected = [];

      const yeasMoverQualifier = document.getElementById('yeasMoverQualifier');
      if (yeasMoverQualifier) yeasMoverQualifier.checked = false;

      document.querySelectorAll('.matrix-table input[type="checkbox"]').forEach(cb => cb.checked = false);

      if (headJurController) headJurController.setSelected([]);
      if (headYeasController) headYeasController.setSelected([]);
      if (headNaysController) headNaysController.setSelected([]);
      if (headStatusController) headStatusController.setSelected([]);

      updateResetFiltersBtnVisibility();
      applyHeaderFilters();
      console.log("Voting Page filters successfully reset!");
    });
  }

  const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
  if (clearAllFiltersBtn) {
    clearAllFiltersBtn.onclick = () => {
      selectedCategories = [];
      selectedProjects = [];
      document.querySelectorAll('.cat-checkbox, .proj-checkbox').forEach(cb => cb.checked = false);
      renderActiveFilters();
      applyHeaderFilters();
    };
  }

  function loadDecisions() {
    fetch(`/api/decisions?jur=Mid-Island%20Region`)
      .then(res => res.json())
      .then(data => {
        rawDecisionsData = data.decisions || [];
        processAndRenderDecisions();
      })
      .catch(err => {
        console.warn("Backend decision API server offline. Re-routing requests to local fallbacks...");
        fetch('https://vancouver-island-regional-database.github.io/document-index/site-data/ladysmith_decisions.json')
          .then(res => res.json())
          .then(data => {
            rawDecisionsData = data.decisions || [];
            processAndRenderDecisions();
          })
          .catch(localErr => {
            console.error("Fatal: Failed to load local JSON fallbacks for Voting Records!", localErr);
            const body = document.getElementById('decisionsBody');
            if (body) {
              body.innerHTML = `<tr><td colspan="11" style="padding:16px; text-align:center; color:#ef4444; font-family:monospace;">
                <strong>Failed to load voting data database.</strong><br>
                API Error: ${err.message || err}<br>
                Local Error: ${localErr.message || localErr}<br>
                Stack: ${localErr.stack || 'N/A'}
              </td></tr>`;
            }
          });
      });

  }

  function processAndRenderDecisions() {
    const jurs = new Set();
    const movers = new Set();

    rawDecisionsData.forEach(d => {
      if (d.jurisdiction) jurs.add(d.jurisdiction);
      if (d.mover) movers.add(d.mover);
    });

    const jurOptions = document.getElementById('headJurOptions');
    if (jurOptions) {
      jurOptions.innerHTML = '';
      jurs.forEach(j => {
        jurOptions.innerHTML += `<label class="dropdown-option"><input type="checkbox" value="${j}"> <span>${j}</span></label>`;
      });
    }

    const allMembersList = getAllCouncilMembers();

    const yeasOptions = document.getElementById('headYeasOptions');
    if (yeasOptions) {
      yeasOptions.innerHTML = '';
      allMembersList.forEach(m => {
        yeasOptions.innerHTML += `<label class="dropdown-option"><input type="checkbox" value="${m}"> <span>${m}</span></label>`;
      });
    }

    const naysOptions = document.getElementById('headNaysOptions');
    if (naysOptions) {
      naysOptions.innerHTML = '';
      allMembersList.forEach(m => {
        naysOptions.innerHTML += `<label class="dropdown-option"><input type="checkbox" value="${m}"> <span>${m}</span></label>`;
      });
    }

    const statusOptions = document.getElementById('headStatusOptions');
    if (statusOptions) {
      statusOptions.innerHTML = '';
      const statusOptionsList = [
        { value: "PASSED", label: "✅ Passed" },
        { value: "DEFEATED", label: "❌ Defeated" },
        { value: "UNANIMOUS", label: "🤝 Unanimous" },
        { value: "SPLIT", label: "⚖️ Split Vote" },
        { value: "1ST_READING", label: "🆕 1st Reading" },
        { value: "2ND_READING", label: "📖 2nd Reading" },
        { value: "3RD_READING", label: "✍️ 3rd Reading" },
        { value: "DEFERRED", label: "⏸️ Deferred" },
        { value: "REPEALED", label: "↩️ Repealed" },
        { value: "FAST_TRACKED", label: "⏩ Fast-tracked" }
      ];
      statusOptionsList.forEach(st => {
        statusOptions.innerHTML += `<label class="dropdown-option"><input type="checkbox" value="${st.value}"> <span>${st.label}</span></label>`;
      });
    }

    headJurController = setupTableMultiSelect('headJur', 'Jurisdiction');
    headYeasController = setupTableMultiSelect('headYeas', 'Votes In Favour');
    headNaysController = setupTableMultiSelect('headNays', 'Votes Opposed');
    headStatusController = setupTableMultiSelect('headStatus', 'Status');

    const yeasMoverQualifier = document.getElementById('yeasMoverQualifier');
    if (yeasMoverQualifier) {
      yeasMoverQualifier.onchange = () => {
        applyHeaderFilters();
        renderActiveFilters();
      };
    }

    [headRecusalSelect].forEach(select => {
      if (select) select.onchange = () => {
        applyHeaderFilters();
        renderActiveFilters();
      };
    });

    if (thDate) {
      thDate.onclick = () => {
        dateSortAsc = !dateSortAsc;
        if (sortArrow) sortArrow.innerText = dateSortAsc ? '↑' : '↓';
        applyHeaderFilters();
      };
    }

    if (decisionSearchInput) {
      decisionSearchInput.onkeyup = () => {
        applyHeaderFilters();
        renderActiveFilters();
      };
    }

    const unknownDateSelect = document.getElementById('unknownDateFilterSelect');
    if (unknownDateSelect) {
      unknownDateSelect.onchange = () => {
        applyHeaderFilters();
        renderActiveFilters();
      };
    }

    [dateStart, dateEnd].forEach(input => {
      if (input) {
        input.onchange = () => {
          applyHeaderFilters();
          renderActiveFilters();
        };
      }
    });

    updateSidebarProjects();
    updateResetFiltersBtnVisibility();
    applyHeaderFilters();
  }

  function updateResetFiltersBtnVisibility() {
    const qVal = decisionSearchInput ? decisionSearchInput.value.trim().toLowerCase() : '';
    const sVal = dateStart ? dateStart.value : '';
    const eVal = dateEnd ? dateEnd.value : '';
    const rVal = headRecusalSelect ? headRecusalSelect.value : '';

    const yeasMoverQualifier = document.getElementById('yeasMoverQualifier');
    const moverQualifierChecked = yeasMoverQualifier ? yeasMoverQualifier.checked : false;

    const hasFilters = !!(qVal || sVal || eVal || headJurSelected.length > 0 || rVal || headYeasSelected.length > 0 || headNaysSelected.length > 0 || headStatusSelected.length > 0 || selectedMemberFilter || moverQualifierChecked);

    if (clearDateBtn) {
      clearDateBtn.style.display = 'inline-block';
      clearDateBtn.disabled = !hasFilters;
    }
  }

  function applyHeaderFilters() {
    const qVal = decisionSearchInput ? decisionSearchInput.value.trim().toLowerCase() : '';
    const sVal = dateStart ? dateStart.value : '';
    const eVal = dateEnd ? dateEnd.value : '';
    const rVal = headRecusalSelect ? headRecusalSelect.value : '';

    const yeasMoverQualifier = document.getElementById('yeasMoverQualifier');
    const moverQualifierChecked = yeasMoverQualifier ? yeasMoverQualifier.checked : false;

    updateResetFiltersBtnVisibility();

    const defaultTitles = {
      headRecusalSelect: "COI"
    };

    [headRecusalSelect].forEach(sel => {
      if (sel && sel.options.length > 0) {
        const def = defaultTitles[sel.id] || sel.options[0].text;
        sel.options[0].text = sel.value ? "All" : def;
      }
    });
    let filtered = rawDecisionsData.filter(d => {
      if (d.motion) {
        const mLower = d.motion.toLowerCase();
        const isHousekeeping = [
          'adjourn', 'adjournment', 'recess', 'reconvene', 'reconvened',
          'adopt the minutes', 'adoption of minutes', 'approve the minutes', 'approval of minutes', 'minutes of the',
          'adoption of the agenda', 'adopt the agenda', 'approve the agenda',
          'retire into closed', 'retire into closed session'
        ].some(kw => mLower.includes(kw));
        if (isHousekeeping) return false;
      }

      let matchText = true;
      if (qVal) {
        const blob = `${d.motion || ''} ${d.res_num || ''} ${d.mover || ''} ${d.jurisdiction || ''} ${d.recusals || ''}`.toLowerCase();
        matchText = blob.includes(qVal);
      }

      let matchCat = true;
      const allFilters = [...selectedCategories, ...selectedProjects];
      if (allFilters.length > 0) {
        const cBlob = `${d.motion || ''} ${d.res_num || ''}`.toLowerCase();
        matchCat = allFilters.some(f => cBlob.includes(f.toLowerCase()));
      }

      const unknownDateSelect = document.getElementById('unknownDateFilterSelect');
      const uOpt = unknownDateSelect ? unknownDateSelect.value : 'ALL';
      const isUnknown = !d.date || d.date.toLowerCase() === 'historical record' || d.date.toLowerCase() === 'unknown' || d.date === 'n/a';

      if (uOpt === 'HIDE' && isUnknown) return false;
      if (uOpt === 'ONLY' && !isUnknown) return false;

      let matchDate = true;
      if (!isUnknown) {
        let matchStart = !sVal || d.date >= sVal;
        let matchEnd = !eVal || d.date <= eVal;
        matchDate = matchStart && matchEnd;
      } else if (sVal || eVal) {
        matchDate = (uOpt === 'ONLY');
      }

      if (d.jurisdiction && (d.jurisdiction.includes("Rossland") || d.jurisdiction.includes("Okanagan"))) {
        return false;
      }

      let matchCheckedJur = d.jurisdiction && selectedJurs.includes(d.jurisdiction);
      let matchJur = (headJurSelected.length === 0 || headJurSelected.includes(d.jurisdiction)) && matchCheckedJur;

      let matchMover = true;
      if (moverQualifierChecked && headYeasSelected.length > 0) {
        matchMover = d.mover && headYeasSelected.includes(d.mover.trim());
      }

      let isPassed = !d.outcome || d.outcome.toUpperCase().includes('CARRIED');

      const unrecordedValues = ['none', 'n/a', '0', 'none specified', 'none recorded', 'not specified', 'unrecorded', '-', ''];

      let matchRecusal = true;
      if (rVal === "WITH_COI") {
        matchRecusal = d.recusals && !unrecordedValues.includes(d.recusals.trim().toLowerCase());
      } else if (rVal === "NO_COI") {
        matchRecusal = !d.recusals || unrecordedValues.includes(d.recusals.trim().toLowerCase());
      }

      let matchYeaFilter = headYeasSelected.length === 0 || headYeasSelected.some(y => {
        return d.yeas && d.yeas.includes(y);
      });

      let matchNayFilter = headNaysSelected.length === 0 || headNaysSelected.some(n => {
        return d.nays && d.nays.includes(n);
      });

      let matchMember = true;
      if (selectedMemberFilter) {
        matchMember = (d.mover && d.mover.includes(selectedMemberFilter)) ||
          (d.yeas && d.yeas.includes(selectedMemberFilter)) ||
          (d.nays && d.nays.includes(selectedMemberFilter)) ||
          (d.recusals && d.recusals.includes(selectedMemberFilter));
      }

      let matchStatus = true;
      if (headStatusSelected.length > 0) {
        const selectedOutcomes = headStatusSelected.filter(v => ["PASSED", "DEFEATED"].includes(v));
        const selectedConsensus = headStatusSelected.filter(v => ["UNANIMOUS", "SPLIT"].includes(v));
        const selectedStages = headStatusSelected.filter(v => ["1ST_READING", "2ND_READING", "3RD_READING", "DEFERRED", "REPEALED", "FAST_TRACKED"].includes(v));

        let matchOutcome = true;
        if (selectedOutcomes.length > 0) {
          matchOutcome = selectedOutcomes.some(val => {
            if (val === "PASSED") return isPassed;
            if (val === "DEFEATED") return !isPassed;
            return false;
          });
        }

        let matchCons = true;
        if (selectedConsensus.length > 0) {
          matchCons = selectedConsensus.some(val => {
            if (val === "UNANIMOUS") return !d.nays || unrecordedValues.includes(d.nays.trim().toLowerCase());
            if (val === "SPLIT") return d.nays && !unrecordedValues.includes(d.nays.trim().toLowerCase());
            return false;
          });
        }

        let matchStg = true;
        if (selectedStages.length > 0) {
          matchStg = selectedStages.some(val => {
            const mLower = (d.motion || '').toLowerCase();
            const oLower = (d.outcome || '').toLowerCase();
            if (val === "1ST_READING") return mLower.includes("first reading") || mLower.includes("1st reading") || oLower.includes("1st reading");
            if (val === "2ND_READING") return mLower.includes("second reading") || mLower.includes("2nd reading") || oLower.includes("2nd reading");
            if (val === "3RD_READING") return mLower.includes("third reading") || mLower.includes("3rd reading") || oLower.includes("3rd reading") || oLower.includes("adopted");
            if (val === "DEFERRED") return mLower.includes("deferred") || mLower.includes("tabled") || mLower.includes("postponed");
            if (val === "REPEALED") return mLower.includes("repealed") || mLower.includes("rescinded");
            if (val === "FAST_TRACKED") return mLower.includes("fast-track") || mLower.includes("three readings");
            return false;
          });
        }

        matchStatus = matchOutcome && matchCons && matchStg;
      }

      return matchText && matchCat && matchDate && matchJur && matchMover && matchRecusal && matchYeaFilter && matchNayFilter && matchMember && matchStatus;
    });

    filtered.sort((a, b) => {
      if (dateSortAsc) return (a.date || '').localeCompare(b.date || '');
      return (b.date || '').localeCompare(a.date || '');
    });

    renderMatrixTable(filtered);
  }

  function renderMatrixTable(decisions) {
    const body = document.getElementById('decisionsBody');
    if (!body) return;
    body.innerHTML = '';

    if (decisions.length === 0) {
      body.innerHTML = '<tr><td colspan="8" style="padding:16px; text-align:center; color:#94a3b8;">No voting records found matching selected criteria.</td></tr>';
      return;
    }

    decisions.forEach(row => {
      const tr = document.createElement('tr');
      const resDisplay = row.res_num ? `<a href="#" class="res-link" data-res="${row.res_num}" title="view all records"><strong>${row.res_num}</strong></a>` : 'N/A';
      const resLinkBtn = row.res_num ? ` <a href="#" class="res-link" data-res="${row.res_num}"><br><u>View record↗</u></a>` : '';
      let rawMotion = row.motion_summary || row.motion || '';
      rawMotion = rawMotion.replace(/^[,;\s]*(?:as amended(?:,?\s*reads?:?)?[,;\s]*)/i, '').trim();
      rawMotion = rawMotion.replace(/^[,;\s]+/, '').trim();
      const motionDesc = `${rawMotion}${resLinkBtn}`;

      const unrecordedValues = ['none', 'n/a', '0', 'none recorded', 'unrecorded', '-', ''];

      const isNoCoi = !row.recusals || unrecordedValues.includes(row.recusals.trim().toLowerCase());
      const recusalCell = !isNoCoi ? `<span class="pill pill-red click-filter-coi" style="cursor:pointer;" title="Conflict of Interest: ${row.recusals}">${row.recusals}</span>` : '<span style="color:#94a3b8;">N/A</span>';

      let yeasList = parseMemberNames(row.yeas);
      let naysList = parseMemberNames(row.nays);

      const yeasHtml = yeasList.length > 0 ? yeasList.map(m => {
        const isActive = headYeasSelected.includes(m);
        const style = isActive ? 'outline:2px solid #38bdf8; font-weight:700;' : '';
        const isMoverMatch = row.mover && row.mover.trim() === m;
        const pillClass = isMoverMatch ? 'pill-dark-green' : 'pill-green';
        return `<span class="pill ${pillClass} click-member-filter" data-member="${m}" style="cursor:pointer; ${style}">${m}</span>`;
      }).join(' ') : '<span style="color:#94a3b8;">N/A</span>';

      const naysHtml = naysList.length > 0 ? naysList.map(m => {
        const isActive = headNaysSelected.includes(m);
        const style = isActive ? 'outline:2px solid #38bdf8; font-weight:700;' : '';
        return `<span class="pill pill-red click-member-filter" data-member="${m}" style="cursor:pointer; ${style}">${m}</span>`;
      }).join(' ') : '<span style="color:#94a3b8;">N/A</span>';

      const jurDisplay = `<span class="click-filter-jur" data-jur="${row.jurisdiction}" style="cursor:pointer; color:var(--accent-blue); text-decoration:underline; font-weight:500;">${row.jurisdiction}</span>`;

      const mLower = (row.motion || '').toLowerCase();
      const mHead  = mLower.slice(0, 350); // cap to avoid boilerplate deep in long docs
      const oLower = (row.outcome || '').toLowerCase();

      const isFastTracked  = mHead.includes('first three readings') || mHead.includes('first, second and third') || mHead.includes('three readings') || mHead.includes('fast-track');
      const hasFirst       = !isFastTracked && (mHead.includes('first reading')  || mHead.includes('1st reading'));
      const hasSecond      = !isFastTracked && (mHead.includes('second reading') || mHead.includes('2nd reading'));
      const hasThird       = !isFastTracked && (mHead.includes('third reading')  || mHead.includes('3rd reading') || mHead.includes('adopted'));
      const isDeferred     = mLower.includes('deferred') || mLower.includes('tabled') || mLower.includes('postponed');
      const isRepealed     = mLower.includes('repealed') || mLower.includes('rescinded');

      const isPassed   = oLower.includes('carried') || oLower.includes('passed');
      const isDefeated = oLower.includes('defeated') || oLower.includes('failed') || oLower.includes('rejected');
      const hasNaysRow = row.nays && !unrecordedValues.includes(row.nays.trim().toLowerCase());
      const consensus  = hasNaysRow ? 'Split' : 'Unanimous';

      let stageIcons = '';
      if (isFastTracked)   stageIcons += '⏩🆕📖✍️';
      else {
        if (hasFirst)  stageIcons += '🆕';
        if (hasSecond) stageIcons += '📖';
        if (hasThird)  stageIcons += '✍️';
      }
      if (isDeferred)  stageIcons += '⏸️';
      if (isRepealed)  stageIcons += '↩️';
      if (isPassed)    stageIcons += '✅';
      if (isDefeated)  stageIcons += '❌';

      if (!stageIcons) {
        if (isPassed)    stageIcons = '✅';
        else if (isDefeated) stageIcons = '❌';
      }

      const consColor  = hasNaysRow ? '#ef4444' : '#94a3b8';
      const showConsensus = isPassed || isDefeated;

      const statusCellHtml = stageIcons
        ? `<div style="line-height:1.5;">${stageIcons} <strong>${row.date || ''}</strong></div>` +
          (showConsensus ? `<div style="font-size:0.75rem; color:${consColor}; font-style:italic; padding-left:4px;">${consensus}</div>` : '')
        : '<span class="text-muted">N/A</span>';

      tr.innerHTML = `
        <td>${row.date || 'Unknown'}</td>
        <td>${jurDisplay}</td>
        <td>${resDisplay}</td>
        <td class="motion-desc-cell" style="text-align: left; max-width: 350px;" title="${String(row.motion || '').replace(/"/g, '&quot;')}">${motionDesc}</td>
        <td style="text-align: left;">${statusCellHtml}</td>
        <td>${recusalCell}</td>
        <td style="text-align: left;">${yeasHtml}</td>
        <td style="text-align: left;">${naysHtml}</td>
      `;

      tr.querySelectorAll('.click-member-filter').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          const clickedMember = b.dataset.member;
          if (b.classList.contains('pill-green') || b.classList.contains('pill-dark-green')) {
            let newYeas = [...headYeasSelected];
            if (newYeas.includes(clickedMember)) {
              newYeas = newYeas.filter(x => x !== clickedMember);
            } else {
              newYeas.push(clickedMember);
            }
            if (headYeasController) headYeasController.setSelected(newYeas);
          } else if (b.classList.contains('pill-red')) {
            let newNays = [...headNaysSelected];
            if (newNays.includes(clickedMember)) {
              newNays = newNays.filter(x => x !== clickedMember);
            } else {
              newNays.push(clickedMember);
            }
            if (headNaysController) headNaysController.setSelected(newNays);
          }
          applyHeaderFilters();
          renderActiveFilters();
        };
      });

      body.appendChild(tr);
    });

    document.querySelectorAll('.click-filter-jur').forEach(b => {
      b.onclick = (e) => {
        const jur = e.target.dataset.jur;
        headJurSelected = [jur];
        if (headJurController) headJurController.setSelected([jur]);
        applyHeaderFilters();
        renderActiveFilters();
      };
    });

    document.querySelectorAll('.click-filter-coi').forEach(b => {
      b.onclick = () => {
        if (headRecusalSelect) headRecusalSelect.value = "WITH_COI";
        applyHeaderFilters();
        renderActiveFilters();
      };
    });

    document.querySelectorAll('.res-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const resNum = link.dataset.res;
        window.location.href = `search-page_index.html?q=${encodeURIComponent(resNum)}&tab=tab-docs`;
      };
    });
  }

  document.addEventListener('click', (e) => {
    document.querySelectorAll('.matrix-table .dropdown-menu').forEach(menu => {
      const dropdown = menu.closest('.custom-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  });

  loadDecisions();
});
