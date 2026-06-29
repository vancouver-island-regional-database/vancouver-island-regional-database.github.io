let documents = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('data/ladysmith.json');
        documents = await res.json();
        initCategories();
        renderTable(documents);
    } catch (err) {
        console.error('Error loading static dataset:', err);
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="5" style="text-align: center; color: #d9534f; padding: 20px;">Failed to load static database index.</td></tr>`;
    }

    document.getElementById('btnSearch').addEventListener('click', runSearch);
    document.getElementById('termInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') runSearch();
    });
    document.getElementById('categoryFilter').addEventListener('change', runSearch);
    document.querySelectorAll('input[name="matchMode"]').forEach(r => r.addEventListener('change', runSearch));
});

function initCategories() {
    const cats = new Set();
    documents.forEach(d => {
        if (d.category) {
            d.category.split(',').forEach(c => cats.add(c.trim()));
        }
    });
    const sel = document.getElementById('categoryFilter');
    Array.from(cats).sort().forEach(c => {
        if (c) {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        }
    });
}

function runSearch() {
    const term = document.getElementById('termInput').value.trim().toLowerCase();
    const cat = document.getElementById('categoryFilter').value;
    const mode = document.querySelector('input[name="matchMode"]:checked').value;

    const filtered = documents.filter(doc => {
        if (cat && (!doc.category || !doc.category.includes(cat))) return false;
        if (!term) return true;

        const blob = `${doc.title || ''} ${doc.snippet || ''} ${doc.category || ''}`.toLowerCase();

        if (mode === 'exact') {
            return blob.includes(term);
        } else if (mode === 'and') {
            const parts = term.split(/\s+/).filter(Boolean);
            return parts.every(p => blob.includes(p));
        } else if (mode === 'or') {
            const parts = term.split(/\s+/).filter(Boolean);
            return parts.some(p => blob.includes(p));
        }
        return true;
    });

    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById('tableBody');
    document.getElementById('resultCount').textContent = list.length;
    document.getElementById('totalCount').textContent = `${documents.length} Total Records`;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #8d99ae; padding: 30px;">No matching records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(d => `
        <tr>
            <td style="color: #606062; white-space: nowrap;">${d.date || 'N/A'}</td>
            <td style="font-weight: 600; color: #003366;">${escape(d.title || 'Untitled Record')}</td>
            <td><span class="badge-cat">${escape(d.category || 'General')}</span></td>
            <td style="color: #47474A; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escape(d.snippet || '')}</td>
            <td>${d.url ? `<a href="${d.url}" target="_blank" style="color: #003366; font-weight: bold; text-decoration: none;">Link ↗</a>` : '<span style="color: #8d99ae;">Archived</span>'}</td>
        </tr>
    `).join('');
}

function escape(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
