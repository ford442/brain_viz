// [Neuro-Weaver] Tab bar and accordion-section interaction, persisted via
// localStorage/sessionStorage. Must run after mountControlsShell() has inserted
// the tab/section markup into the DOM.
export function initTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const storageKey = 'neuro_weaver_active_tab';

    function activateTab(tabId) {
        tabBtns.forEach(btn => {
            if (btn.dataset.tab === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        tabPanes.forEach(pane => {
            if (pane.id === tabId) pane.classList.add('active');
            else pane.classList.remove('active');
        });
        try { localStorage.setItem(storageKey, tabId); } catch (e) {}
    }
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });
    const requestedTab = new URLSearchParams(window.location.search).get('openTab');
    const requestedTabId = requestedTab ? `tab-${requestedTab}` : null;
    const savedTab = localStorage.getItem(storageKey);
    if (requestedTabId && document.getElementById(requestedTabId)) {
        activateTab(requestedTabId);
    } else if (savedTab && document.getElementById(savedTab)) {
        activateTab(savedTab);
    }

    // --- Accordion Sections ---
    const sectionHeaders = document.querySelectorAll('.section-header');
    const sectionPrefix = 'neuro_weaver_section_';

    sectionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const isExpanded = header.classList.contains('expanded');
            header.classList.toggle('expanded');
            const sectionId = header.dataset.section;
            if (sectionId) {
                try {
                    sessionStorage.setItem(sectionPrefix + sectionId, String(!isExpanded));
                } catch (e) {}
            }
        });
    });

    // Restore section states
    sectionHeaders.forEach(header => {
        const sectionId = header.dataset.section;
        if (!sectionId) return;
        const saved = sessionStorage.getItem(sectionPrefix + sectionId);
        if (saved !== null) {
            if (saved === 'true') {
                header.classList.add('expanded');
            } else {
                header.classList.remove('expanded');
            }
        } else {
            // Default: only the first section-header inside each tab-pane is expanded.
            const pane = header.closest('.tab-pane');
            if (pane) {
                const first = pane.querySelector('.section-header');
                if (header === first) {
                    header.classList.add('expanded');
                } else {
                    header.classList.remove('expanded');
                }
            }
        }
    });
}
