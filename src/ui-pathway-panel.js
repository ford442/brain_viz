import { PATHWAYS, DOPAMINE_PATHWAY_DEMO } from './pathways.js';

export function setupPathwayPanel(renderer, player, modeSelector) {
    const select = document.getElementById('pathway-select');
    const pulseButton = document.getElementById('pathway-pulse');
    const blockButton = document.getElementById('pathway-block');
    const demoButton = document.getElementById('pathway-demo');
    const status = document.getElementById('pathway-status');
    const swatch = document.getElementById('pathway-color');
    if (!select || !pulseButton || !blockButton || !demoButton) return null;

    for (const pathway of Object.values(PATHWAYS)) {
        const option = document.createElement('option');
        option.value = pathway.id;
        option.textContent = pathway.name;
        select.appendChild(option);
    }

    const selectedId = () => select.value;
    const update = () => {
        const state = renderer.getPathwayState();
        const pathway = PATHWAYS[selectedId()];
        if (swatch && pathway) swatch.style.backgroundColor = `rgb(${pathway.color.map((value) => Math.round(value * 255)).join(',')})`;
        blockButton.textContent = state.blocked ? 'Unblock' : 'Block';
        blockButton.setAttribute('aria-pressed', String(state.blocked));
        if (status) status.textContent = state.blocked
            ? 'blocked: static and pulse emission suppressed'
            : state.pulseActive ? `pulse: ${(state.progress * 100).toFixed(0)}%` : 'ready: low static pathway highlight';
    };

    select.addEventListener('change', () => {
        renderer.selectPathway(selectedId());
        update();
    });
    pulseButton.addEventListener('click', () => {
        modeSelector.applyStyle(2);
        renderer.pulsePathway(selectedId(), { duration: PATHWAYS[selectedId()].defaultPulseDuration, intensity: 1 });
        update();
    });
    blockButton.addEventListener('click', () => {
        const state = renderer.getPathwayState();
        renderer.setPathwayBlocked(selectedId(), !state.blocked);
        update();
    });
    demoButton.addEventListener('click', () => {
        modeSelector.applyStyle(2);
        player.playNow(DOPAMINE_PATHWAY_DEMO);
        update();
    });

    renderer.selectPathway(select.value || Object.keys(PATHWAYS)[0]);
    update();
    const timer = setInterval(update, 150);
    return { update, dispose: () => clearInterval(timer) };
}
