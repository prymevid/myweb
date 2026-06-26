/* RoadRules Creative Circling Loaders - JS */

/* Style 1: Orbit Loader */
window.RoadRulesLoaderStyle = window.RoadRulesLoaderStyle || 'orbit';

function getLoaderHTML(style) {
  if (style === 'cosmic') return getCosmicLoaderHTML();
  if (style === 'pulse') return getPulseLoaderHTML();
  return getOrbitLoaderHTML();
}

function getOrbitLoaderHTML() {
  return `
    <div class="rr-loader-orbit">
      <div class="orbit-ring"></div>
      <div class="orbit-ring orbit-ring-2"></div>
      <div class="orbit-dot d1"></div>
      <div class="orbit-dot d2"></div>
      <div class="orbit-dot d3"></div>
      <div class="orbit-dot d4"></div>
      <div class="orbit-center"><i class="fa-solid fa-road"></i></div>
    </div>
    <div class="font-bold text-[18px] tracking-tight text-slate-800 dark:text-slate-100">Tegereza Gato</div>
    <div id="rr-loader-sub" class="text-[12.5px] text-slate-500 dark:text-slate-400 mt-2.5 min-h-[18px] font-medium"></div>
  `;
}

function getCosmicLoaderHTML() {
  return `
    <div class="rr-loader-cosmic">
      <div class="cosmic-ring ring-1"></div>
      <div class="cosmic-ring ring-2"></div>
      <div class="cosmic-ring ring-3"></div>
      <div class="comet"></div>
      <div class="cosmic-center"><i class="fa-solid fa-road"></i></div>
    </div>
    <div class="font-bold text-[18px] tracking-tight text-slate-800 dark:text-slate-100">Tegereza Gato</div>
    <div id="rr-loader-sub" class="text-[12.5px] text-slate-500 dark:text-slate-400 mt-2.5 min-h-[18px] font-medium"></div>
  `;
}

function getPulseLoaderHTML() {
  return `
    <div class="rr-loader-pulse">
      <div class="pulse-ring"></div>
      <div class="pulse-ring"></div>
      <div class="pulse-ring"></div>
      <div class="pulse-icon"><i class="fa-solid fa-road"></i></div>
    </div>
    <div class="font-bold text-[18px] tracking-tight text-slate-800 dark:text-slate-100">Tegereza Gato</div>
    <div id="rr-loader-sub" class="text-[12.5px] text-slate-500 dark:text-slate-400 mt-2.5 min-h-[18px] font-medium"></div>
  `;
}
