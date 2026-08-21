

function initializeLayout(config) {
  const root = document.getElementById('vird-layout-root');
  const slot = document.getElementById('page-content-slot');
  if (!root || !slot) {
    console.error("VIRD Layout Error: Root layout container or page slot not found!");
    return;
  }

  const slotContent = slot.innerHTML;

  const heroHtml = config.heroImage ? `
      <section class="db-hero" style="--hero-image:url('${config.heroImage}')">
        <div class="db-hero-inner">
          <div class="breadcrumbs">
            <a href="index.html">Home</a>
            <span>&gt;</span>
            ${config.heroBreadcrumb || config.title}
          </div>
          <h2>${config.heroTitle || config.title}</h2>
          <p>${config.heroSubtitle || config.subtitle}</p>
        </div>
      </section>` : '';

  const pageHeaderHtml = config.heroImage ? '' : `
          <div class="page-header">
            <div class="page-title-row">
              <div>
                <h1>${config.title}</h1>
                <p>${config.subtitle}</p>
              </div>
            </div>
          </div>`;

  root.innerHTML = `
    <div class="app-container">
      <!-- 1. MASTER TOP HEADER (matches header markup used site-wide) -->
      <header>
        <div class="header-brand">
          <a href="index.html"><img src="assets/vird_logo_white.png" alt="VIRD Logo" onerror="this.style.display='none';"></a>
          <div class="header-title-block">
            <h1>Vancouver Island Regional Database</h1>
            <span class="header-tagline">Public Access to Public Data</span>
          </div>
        </div>
        <a class="header-action-badge" href="index.html">HOME</a>
      </header>

      <div class="main-layout" style="position:relative;">
        <!-- 2. MASTER SIDEBAR (formerly "Special Collections") -->
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-header" style="margin-bottom:12px;">
            <label class="sidebar-label" style="font-size: 1.1rem; font-weight: 700; color: var(--bc-blue); margin-bottom: 4px; display: block; border-bottom: 2px solid var(--bc-gold); padding-bottom: 6px;">
              Browse by Topic
            </label>
          </div>
          <div class="nav-sections">
            <div class="nav-group">
              <div class="nav-title">Categories</div>
              <div class="nav-cat-list" id="genCatList">
                <label class="nav-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" value="Water Systems" class="cat-checkbox" style="cursor:pointer;">
                  <span>Water Systems</span>
                </label>
                <label class="nav-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" value="Land Use Planning" class="cat-checkbox" style="cursor:pointer;">
                  <span>Land Use Planning</span>
                </label>
                <label class="nav-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" value="Major Developments" class="cat-checkbox" style="cursor:pointer;">
                  <span>Major Developments</span>
                </label>
                <label class="nav-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" value="Parks & Community Facilities" class="cat-checkbox" style="cursor:pointer;">
                  <span>Parks & Community Facilities</span>
                </label>
                <label class="nav-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" value="Natural Resources" class="cat-checkbox" style="cursor:pointer;">
                  <span>Natural Resources</span>
                </label>
                <label class="nav-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" value="Infrastructure & Services" class="cat-checkbox" style="cursor:pointer;">
                  <span>Infrastructure & Services</span>
                </label>
              </div>
            </div>
            <!-- Key Projects hidden: project keyword matching isn't
                 validated/accurate yet. Re-enable once the project keyword
                 lists have been checked against real results. -->
            <div class="nav-group" style="display:none;">
              <div class="nav-title">Key Projects</div>
              <div class="nav-cat-list" id="projectCatList"></div>
            </div>
          </div>
        </aside>

        <!-- Sidebar Folding Flap -->
        <button id="sideTabFlap" class="side-tab-flap" title="Toggle Categories Panel">
          <span id="flapIcon">◀</span>
        </button>
        <div class="resizer" id="resizer"></div>

        <!-- 3. MAIN CONTENT AREA -->
        <main class="content-area${config.heroImage ? ' has-hero' : ''}">${heroHtml}${pageHeaderHtml}

          <!-- Sticky Search & Date Filter Bar -->
          <div class="date-filter-bar sticky-filter-row">
            <input type="text" id="decisionSearchInput" placeholder="${config.searchPlaceholder}">
            <select id="unknownDateFilterSelect" style="padding:6px 10px; background:white; border:1px solid var(--border); border-radius:4px; color:var(--text); font-size:0.82rem; outline:none;">
              <option value="ALL">📅 All Dates</option>
              <option value="HIDE">🚫 Hide Unknown Dates</option>
              <option value="ONLY">❓ Only Unknown Dates</option>
            </select>
            <label>From: <input type="date" id="dateStart"></label>
            <label>To: <input type="date" id="dateEnd"></label>
          </div>

          <!-- Selected Collections / Active Filters Bar -->
          <div id="activeFiltersBar" style="display: none; gap: 8px; flex-wrap: wrap; align-items: center; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid var(--border); margin-top: 12px; margin-bottom: 12px; width: 100%;">
            <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px;">Selected Collections:</span>
            <div id="activeFiltersContainer" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;"></div>
            <button id="clearAllFiltersBtn" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-left:auto;">✕ clear all</button>
          </div>

          <!-- Dynamic Page Window Content Injection Slot -->
          <div id="vird-page-content">
            ${slotContent}
          </div>
        </main>
      </div>

      <!-- 4. MASTER FOOTER (matches footer markup used site-wide) -->
      <footer>
        <div class="footer-inner">
          <p class="footer-copyright">Vancouver Island Regional Database &bull; Centralized Access to Public Records</p>
          <p class="footer-disclaimer">
            <b>Fair Dealing &amp; Copyright:</b> Vancouver Island Regional Database is not affiliated with any government agency. It is an independent, non-commercial research archive ensuring regional compliance with public access laws and citizens' legal right to access open government data. Materials, text extracts, and HTML copies reproduced directly from primary source public records, without commentary or opinion, for the statutory purposes of Research, Criticism, Review, and News Reporting under Section 29 of the Copyright Act (R.S.C., 1985, c. C-42). External resources linked from this page are independently operated; Vancouver Island Regional Database is not responsible for their content or availability.
          </p>
        </div>
      </footer>
    </div>
  `;

  const sidebar = document.getElementById('sidebar');
  const resizer = document.getElementById('resizer');
  const mainLayout = document.querySelector('.main-layout');
  const sideTabFlap = document.getElementById('sideTabFlap');
  const flapIcon = document.getElementById('flapIcon');

  if (sideTabFlap && sidebar) {
    sideTabFlap.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      if (resizer) resizer.style.display = isCollapsed ? 'none' : 'block';
      if (sideTabFlap) sideTabFlap.style.left = isCollapsed ? '0px' : '320px';
      if (flapIcon) flapIcon.innerText = isCollapsed ? '▶' : '◀';
    });

    if (window.innerWidth <= 820) {
      sidebar.classList.add('collapsed');
      if (resizer) resizer.style.display = 'none';
      if (flapIcon) flapIcon.innerText = '▶';
    }
  }

  if (resizer && sidebar) {
    let isDragging = false;
    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      let newWidth = e.clientX;
      if (newWidth < 100) newWidth = 0;
      if (newWidth > 600) newWidth = 600;

      if (newWidth === 0) {
        sidebar.classList.add('collapsed');
        resizer.style.display = 'none';
        sideTabFlap.style.left = '0px';
        if (flapIcon) flapIcon.innerText = '▶';
      } else {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = newWidth + 'px';
        resizer.style.display = 'block';
        sideTabFlap.style.left = newWidth + 'px';
        if (flapIcon) flapIcon.innerText = '◀';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    });
  }
}
