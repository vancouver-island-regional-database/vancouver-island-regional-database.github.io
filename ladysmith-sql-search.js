let currentCategory = "";
let currentPage = 1;
const recordsPerPage = 25;
let allDocuments = [];
let filteredDocuments = [];

document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupResizer();
    
    try {
        const res = await fetch('data/ladysmith.json');
        allDocuments = await res.json();
        loadSectionsAndCategories();
        applyFiltersAndRender();
    } catch (e) {
        console.error("Error loading Ladysmith dataset:", e);
        document.getElementById('documents-tbody').innerHTML = `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: #ef4444;">Error loading dataset records.</td></tr>`;
    }

    document.getElementById('search-btn').addEventListener('click', () => {
        currentPage = 1;
        applyFiltersAndRender();
    });

    document.getElementById('search-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            currentPage = 1;
            applyFiltersAndRender();
        }
    });

    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTablePage();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage * recordsPerPage < filteredDocuments.length) {
            currentPage++;
            renderTablePage();
        }
    });
});

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function setupResizer() {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('resizer');
    let isResizing = false;

    if (!resizer || !sidebar) return;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = e.clientX;
        if (newWidth >= 220 && newWidth <= 650) {
            sidebar.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });
}

function loadSectionsAndCategories() {
    const catCounts = {};
    allDocuments.forEach(d => {
        if (d.category) {
            d.category.split(',').forEach(c => {
                const clean = c.trim();
                if (clean) catCounts[clean] = (catCounts[clean] || 0) + 1;
            });
        }
    });

    const wrapper = document.getElementById('sections-wrapper');
    wrapper.innerHTML = '';

    const block = document.createElement('div');
    block.className = 'section-block';
    block.innerHTML = `
        <div class="section-header">
            <h4>📂 General Research Categories</h4>
        </div>
        <div class="category-list" id="cat-list-container"></div>
    `;
    wrapper.appendChild(block);

    const listContainer = block.querySelector('#cat-list-container');
    
    const allItem = document.createElement('div');
    allItem.className = 'category-item active';
    allItem.innerHTML = `<span>📋 All Documents Archive</span>`;
    allItem.addEventListener('click', () => {
        document.querySelectorAll('.category-item').forEach(ci => ci.classList.remove('active'));
        allItem.classList.add('active');
        currentCategory = "";
        currentPage = 1;
        applyFiltersAndRender();
    });
    listContainer.appendChild(allItem);

    const sortedCats = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a]);
    sortedCats.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `<span>${escapeHtml(cat)}</span><strong>${catCounts[cat]}</strong>`;
        item.addEventListener('click', () => {
            document.querySelectorAll('.category-item').forEach(ci => ci.classList.remove('active'));
            if (currentCategory === cat) {
                currentCategory = "";
                allItem.classList.add('active');
            } else {
                currentCategory = cat;
                item.classList.add('active');
            }
            currentPage = 1;
            applyFiltersAndRender();
        });
        listContainer.appendChild(item);
    });
}

function applyFiltersAndRender() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();

    filteredDocuments = allDocuments.filter(doc => {
        if (currentCategory && (!doc.category || !doc.category.includes(currentCategory))) {
            return false;
        }

        if (query) {
            const blob = `${doc.title || ''} ${doc.snippet || ''} ${doc.category || ''}`.toLowerCase();
            return blob.includes(query);
        }
        return true;
    });

    renderTablePage();
}

function renderTablePage() {
    const tbody = document.getElementById('documents-tbody');
    const badge = document.getElementById('record-count-badge');
    
    badge.textContent = `${filteredDocuments.length} Documents`;

    if (filteredDocuments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No matching documents found.</td></tr>`;
        document.getElementById('page-indicator').textContent = `Page 1 of 1`;
        return;
    }

    const totalPages = Math.ceil(filteredDocuments.length / recordsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * recordsPerPage;
    const pageDocs = filteredDocuments.slice(start, start + recordsPerPage);

    tbody.innerHTML = '';
    pageDocs.forEach(doc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${doc.date || 'N/A'}</strong></td>
            <td><span style="font-size:0.75rem; color:#38bdf8; display:block;">Mid-Island Region</span><strong>Town of Ladysmith</strong></td>
            <td><a href="${doc.url || '#'}" target="_blank" style="color:#38bdf8; text-decoration:none;">${escapeHtml(doc.title || 'Untitled Document')}</a></td>
            <td><span style="font-size:0.8rem; background:#334155; padding:4px 8px; border-radius:4px;">${escapeHtml(doc.category || 'Unassigned')}</span></td>
            <td style="color:#94a3b8; font-size:0.85rem;">...${escapeHtml(doc.snippet || '')}...</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('page-indicator').textContent = `Page ${currentPage} of ${totalPages}`;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
