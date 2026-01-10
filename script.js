// ================== VARIÁVEIS GLOBAIS ==================
let provider = null;
let signer = null;
let readContract = null;
let writeContract = null;
let marketsData = [];

// ================== CONTRATO ==================
const CONTRACT_ADDRESS = "0xD93C61eBCB06Df15aee3F2DBA1ba89E7614Bd579";

const CONTRACT_ABI = [
  // (ABI mantida exatamente como está no seu projeto)
];

// ================== HELPERS ==================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// ================== TOAST ==================
function toast(title, msg) {
  const el = $("#toast");
  if (!el) return;

  $("#toastTitle").textContent = title;
  $("#toastMsg").textContent = msg;

  el.hidden = false;
  el.classList.add("show");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => (el.hidden = true), 200);
  }, 2400);
}

// ================== TEMA (MANTIDO) ==================
const THEME_KEY = "kalshi_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const lbl = $("#themeLabel");
  if (lbl) lbl.textContent = theme === "light" ? "Claro" : "Escuro";
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersLight =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  }
}

$("#themeToggle")?.addEventListener("click", () => {
  const current =
    document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ================== MENU MOBILE ==================
const burger = $("#burger");
const mobileMenu = $("#mobileMenu");

burger?.addEventListener("click", () => {
  const expanded = burger.getAttribute("aria-expanded") === "true";
  burger.setAttribute("aria-expanded", String(!expanded));
  mobileMenu.hidden = expanded;
});

$$(".mobile__link").forEach(link =>
  link.addEventListener("click", () => {
    burger.setAttribute("aria-expanded", "false");
    mobileMenu.hidden = true;
  })
);

// ================== SCROLL PROGRESS ==================
const fill = $("#scrollbarFill");
window.addEventListener("scroll", () => {
  if (!fill) return;
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  fill.style.width = max > 0 ? `${(doc.scrollTop / max) * 100}%` : "0%";
});

// ================== REVEAL ==================
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add("is-visible");
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

$$(".reveal").forEach(el => io.observe(el));

// ================== MARKETS (MOCK FUNCIONAL) ==================
async function loadMarkets() {
  marketsData = [
    {
      question: "Trump atacará o Irã até março de 2026?",
      theme: "Política",
      yesShares: 60,
      noShares: 40
    },
    {
      question: "Lula será reeleito em 2026?",
      theme: "Política",
      yesShares: 45,
      noShares: 55
    },
    {
      question: "Vai chover amanhã em São Paulo?",
      theme: "Clima",
      yesShares: 30,
      noShares: 70
    },
    {
      question: "O Brasil ganhará a Copa de 2026?",
      theme: "Esporte",
      yesShares: 50,
      noShares: 50
    },
	{
      question: "Quem será o Campeão Paulista de 2026?",
      theme: "Esporte",
      yesShares: 45,
      noShares: 55
    },
	{
      question: "O atual regime do Irá irá cair ?",
      theme: "Politica",
      yesShares: 45,
      noShares: 55
    }
  ];
}

function renderMarkets(list) {
  const wrap = $("#markets");
  if (!wrap) return;

  wrap.innerHTML = "";

  list.forEach((m, idx) => {
    const p = clamp(m.p, 0.01, 0.99);
    let yes = Math.round(p * 100);
    let no = 100 - yes;

    const el = document.createElement("div");
    el.className = "market";
    el.innerHTML = `
      <div class="market__top">
        <div class="market__q">${m.q}</div>
        <div class="market__tag">${m.tag}</div>
      </div>
      <div class="market__bar"><span style="width:${yes}%"></span></div>
      <div class="market__actions">
        <div class="odds">${yes}% Sim • ${no}% Não</div>
        <div class="pair">
          <button data-action="yes">Sim</button>
          <button data-action="no">Não</button>
        </div>
      </div>
    `;

    el.querySelector('[data-action="yes"]').onclick = e => {
      e.stopPropagation();
      if (!writeContract) {
        toast("Carteira não conectada", "Conecte sua carteira para negociar");
        return;
      }
      yes = Math.min(yes + 1, 100);
      no = 100 - yes;
      updateMarket(el, yes, no);
    };

    el.querySelector('[data-action="no"]').onclick = e => {
      e.stopPropagation();
      if (!writeContract) {
        toast("Carteira não conectada", "Conecte sua carteira para negociar");
        return;
      }
      no = Math.min(no + 1, 100);
      yes = 100 - no;
      updateMarket(el, yes, no);
    };

    wrap.appendChild(el);
  });
}

function updateMarket(el, yes, no) {
  el.querySelector(".odds").textContent = `${yes}% Sim • ${no}% Não`;
  el.querySelector(".market__bar span").style.width = `${yes}%`;
}

function updateView() {
  renderMarkets(
    marketsData.map(m => ({
      q: m.question,
      tag: m.theme,
      p: m.yesShares / (m.yesShares + m.noShares)
    }))
  );
}

// ================== CONECTAR CARTEIRA (CORRIGIDO) ==================
async function connectWallet() {
  if (!window.ethereum) {
    toast("Erro", "MetaMask não encontrada");
    return;
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });

  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();

  writeContract = new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    signer
  );

  const address = await signer.getAddress();
  const btn = $("#connectWalletBtn");

  btn.textContent = `Conectado: ${address.slice(0, 6)}...${address.slice(-4)}`;
  btn.disabled = true;

  toast("Sucesso", "Carteira conectada");
}

$("#connectWalletBtn")?.addEventListener("click", connectWallet);

// ================== INIT ==================
window.addEventListener("load", async () => {
  initTheme();

  provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com");
  readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  await loadMarkets();
  updateView();
});

let currentTheme = "Geral";

document.querySelectorAll("#theme-filters .theme-card").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".theme-card").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    currentTheme = btn.dataset.theme;
    updateView();
  });
});

function shuffleArray(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

$("#shuffleBtn")?.addEventListener("click", () => {
  marketsData = shuffleArray(marketsData);
  updateView();
  toast("Atualizado", "Mercados misturados.");
});
