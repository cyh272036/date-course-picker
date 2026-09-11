(() => {
  "use strict";

  const CATEGORIES = [
    {
      id: "where",
      icon: "📍",
      label: "만나는 장소",
      options: ["성수", "홍대", "강남", "이태원", "연남동", "을지로", "잠실", "근교 나들이"],
    },
    {
      id: "activity",
      icon: "🎯",
      label: "무엇을 할지",
      options: ["영화 감상", "쇼핑" , "전시 관람", "공원 산책", "방탈출", "보드게임 카페", "스파 & 힐링", "볼링 & 당구", "드라이브", "공방 클래스", "실내 클라이밍", "LP바 & 청음실", "재즈바 라이브", "소극장 연극", "만화카페", "전통시장 맛집 투어", "당일치기 기차여행", "캠핑 & 글램핑"],
    },
    {
      id: "food",
      icon: "🍽️",
      label: "무엇을 먹을지",
      options: ["한식", "일식", "양식", "중식", "아시안 푸드", "디저트 카페", "브런치", "포장마차 & 술집"],
    },
    {
      id: "transport",
      icon: "🚗",
      label: "어떻게 이동할지",
      options: ["도보", "지하철", "버스", "자차", "택시", "자전거 & 따릉이", "킥보드", "대중교통 + 도보"],
    },
    {
      id: "mood",
      icon: "👗",
      label: "오늘의 룩앤필",
      options: ["꾸안꾸", "시크 & 드레스업", "편안한 스포티룩", "클래식룩", "캐주얼", "러블리", "미니멀", "빈티지"],
    },
    {
      id: "concept",
      icon: "✨",
      label: "오늘의 데이트 컨셉",
      options: ["힐링 & 휴식", "감성 & 인스타 핫플", "활력 & 액티비티", "잔잔한 대화", "로맨틱 무드", "추억 여행", "새로운 도전", "자유로운 즉흥"],
    },
    {
      id: "ending",
      icon: "🌙",
      label: "마무리 활동",
      options: ["각자 조심히 귀가", "맥주 한잔", "야경 드라이브", "2차 카페", "편의점 야식", "손편지 쓰기", "즉석 사진관", "늦은 산책"],
    },
  ];

  const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");

  const state = {
    screen: "mode", // mode | categories | game | result
    mode: null, // random | worldcup
    selected: [], // category ids
    results: {}, // id -> chosen option string
    wc: null, // worldcup runtime state
    sharedView: false,
  };

  const HISTORY_KEY = "dateCoursePicker.history";

  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistoryEntry(entry) {
    try {
      const list = loadHistory();
      list.unshift(entry);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  function deleteHistoryEntry(id) {
    const list = loadHistory().filter((e) => e.id !== id);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      /* ignore */
    }
  }

  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}.${m}.${day} ${hh}:${mm}`;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  function buildShareUrl() {
    const payload = { s: state.selected, r: state.results };
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    return `${url.toString()}?r=${encoded}`;
  }

  function readSharedFromUrl() {
    const params = new URLSearchParams(location.search);
    const r = params.get("r");
    if (!r) return null;
    try {
      const json = decodeURIComponent(escape(atob(decodeURIComponent(r))));
      const payload = JSON.parse(json);
      if (!payload || !Array.isArray(payload.s) || typeof payload.r !== "object") return null;
      return payload;
    } catch (e) {
      return null;
    }
  }

  // ---------- rendering ----------

  function render() {
    app.innerHTML = "";
    if (state.screen === "mode") app.appendChild(renderModeScreen());
    else if (state.screen === "categories") app.appendChild(renderCategoryScreen());
    else if (state.screen === "game") {
      app.appendChild(state.mode === "random" ? renderRandomScreen() : renderWorldcupScreen());
    } else if (state.screen === "result") app.appendChild(renderResultScreen());
    else if (state.screen === "history") app.appendChild(renderHistoryScreen());
  }

  function el(tag, className, html) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function renderBackRow(onBack, progressPct) {
    const row = el("div", "back-row");
    const btn = el("button", "icon-btn", "←");
    btn.addEventListener("click", onBack);
    row.appendChild(btn);
    if (progressPct !== undefined) {
      const track = el("div", "progress-track");
      const fill = el("div", "progress-fill");
      fill.style.width = `${progressPct}%`;
      track.appendChild(fill);
      row.appendChild(track);
    }
    return row;
  }

  function renderModeScreen() {
    const wrap = el("div", "screen");
    wrap.appendChild(el("span", "eyebrow", "💕 오늘 뭐 하지?"));
    wrap.appendChild(el("h1", "title", "고민은 그만,<br/>데이트 코스는 우리가 정해줄게"));
    wrap.appendChild(el("p", "subtitle", "장소부터 마무리까지, 게임처럼 즐겁게 골라보세요."));

    const grid = el("div", "mode-grid");

    const randomCard = el("button", "mode-card variant-random");
    randomCard.innerHTML = `
      <span class="emoji">🎰</span>
      <h3>랜덤 뽑기</h3>
      <p>원하는 항목을 체크하고 버튼 한 번이면, 슬롯머신처럼 즉시 조합이 완성돼요.</p>
      <span class="tag">빠르게 정하기</span>
    `;
    randomCard.addEventListener("click", () => {
      state.mode = "random";
      state.screen = "categories";
      render();
    });

    const wcCard = el("button", "mode-card variant-worldcup");
    wcCard.innerHTML = `
      <span class="emoji">🏆</span>
      <h3>이상형 월드컵</h3>
      <p>카테고리마다 후보들이 토너먼트로 맞붙어요. 마음이 가는 쪽을 계속 골라주세요.</p>
      <span class="tag">둘이 같이 정하기</span>
    `;
    wcCard.addEventListener("click", () => {
      state.mode = "worldcup";
      state.screen = "categories";
      render();
    });

    grid.appendChild(randomCard);
    grid.appendChild(wcCard);
    wrap.appendChild(grid);

    const historyCount = loadHistory().length;
    const historyBtn = el("button", "history-link", `📜 저장된 기록 보기 ${historyCount > 0 ? `(${historyCount})` : ""}`);
    historyBtn.addEventListener("click", () => {
      state.screen = "history";
      render();
    });
    wrap.appendChild(historyBtn);

    return wrap;
  }

  function renderHistoryScreen() {
    const wrap = el("div", "screen");
    wrap.appendChild(
      renderBackRow(() => {
        state.screen = "mode";
        render();
      })
    );
    wrap.appendChild(el("h1", "title", "저장된 데이트 코스"));

    const entries = loadHistory();

    if (entries.length === 0) {
      wrap.appendChild(el("p", "subtitle", "아직 저장된 기록이 없어요. 결과 화면에서 '결과 저장하기'를 눌러보세요!"));
      return wrap;
    }

    wrap.appendChild(el("p", "subtitle", `총 ${entries.length}개의 기록이 있어요.`));

    const list = el("div", "history-list");
    entries.forEach((entry, i) => {
      const card = el("div", "history-card");
      card.style.animationDelay = `${i * 50}ms`;

      const chips = entry.selected
        .map((id) => {
          const cat = CATEGORY_MAP[id];
          const value = entry.results[id];
          if (!cat || !value) return "";
          return `<span class="history-chip">${cat.icon} ${value}</span>`;
        })
        .join("");

      card.innerHTML = `
        <div class="history-card-head">
          <span class="history-date">🗓 ${formatDate(entry.savedAt)}</span>
          <button class="history-delete" aria-label="기록 삭제">✕</button>
        </div>
        <div class="history-chips">${chips}</div>
      `;
      card.querySelector(".history-delete").addEventListener("click", () => {
        deleteHistoryEntry(entry.id);
        render();
      });
      list.appendChild(card);
    });
    wrap.appendChild(list);

    const clearBtn = el("button", "btn btn-ghost", "🗑 전체 기록 삭제");
    clearBtn.style.width = "100%";
    clearBtn.style.marginTop = "18px";
    clearBtn.addEventListener("click", () => {
      if (confirm("저장된 기록을 모두 삭제할까요?")) {
        clearHistory();
        render();
      }
    });
    wrap.appendChild(clearBtn);

    return wrap;
  }

  function renderCategoryScreen() {
    const wrap = el("div", "screen");
    wrap.appendChild(
      renderBackRow(() => {
        state.screen = "mode";
        render();
      })
    );
    wrap.appendChild(el("h1", "title", "무엇을 정할까요?"));
    wrap.appendChild(el("p", "subtitle", "결정하고 싶은 항목을 골라주세요. 최소 1개 이상 선택할 수 있어요."));

    const grid = el("div", "category-grid");
    CATEGORIES.forEach((cat) => {
      const card = el("button", "category-card");
      if (state.selected.includes(cat.id)) card.classList.add("selected");
      card.innerHTML = `
        <span class="icon">${cat.icon}</span>
        <span class="label">${cat.label}</span>
        <span class="check">✓</span>
      `;
      card.addEventListener("click", () => {
        const idx = state.selected.indexOf(cat.id);
        if (idx === -1) state.selected.push(cat.id);
        else state.selected.splice(idx, 1);
        render();
      });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    const nextBtn = el("button", "btn btn-primary", state.mode === "random" ? "랜덤으로 정하기 🎲" : "월드컵 시작하기 🏆");
    nextBtn.disabled = state.selected.length === 0;
    nextBtn.style.marginTop = "20px";
    nextBtn.addEventListener("click", () => {
      if (state.selected.length === 0) return;
      startGame();
    });
    wrap.appendChild(nextBtn);
    return wrap;
  }

  function startGame() {
    state.results = {};
    if (state.mode === "random") {
      state.random = {
        catOrder: state.selected.slice(),
        catIndex: 0,
      };
    }
    if (state.mode === "worldcup") {
      state.wc = {
        catOrder: state.selected.slice(),
        catIndex: 0,
        pool: null,
        winners: [],
        matchIndex: 0,
      };
      setupWorldcupRound(true);
    }
    state.screen = "game";
    render();
  }

  function renderRandomScreen() {
    const flow = state.random;
    const catId = flow.catOrder[flow.catIndex];
    const cat = CATEGORY_MAP[catId];
    const shuffledOptions = shuffle(cat.options);

    const wrap = el("div", "screen");
    wrap.appendChild(
      renderBackRow(() => {
        state.screen = "categories";
        render();
      }, (flow.catIndex / flow.catOrder.length) * 100)
    );

    wrap.appendChild(el("span", "eyebrow", `${cat.icon} ${cat.label} · ${flow.catIndex + 1}/${flow.catOrder.length}`));
    wrap.appendChild(el("h1", "title", "카드를 한 장<br/>뒤집어보세요 🔮"));
    const subtitle = el("p", "subtitle", "마음이 가는 카드를 골라주세요. 그게 오늘의 선택이 돼요.");
    wrap.appendChild(subtitle);

    const grid = el("div", "tarot-grid");
    let pickedValue = null;
    let flippedCount = 0;

    const revealCard = (cardEl, value, isPick) => {
      cardEl.classList.add("flipped");
      if (isPick) cardEl.classList.add("picked");
      const valueEl = cardEl.querySelector(".value");
      valueEl.textContent = value;
      flippedCount += 1;
    };

    const onPick = (cardEl, value) => {
      if (pickedValue !== null) return;
      pickedValue = value;
      state.results[catId] = value;
      revealCard(cardEl, value, true);
      subtitle.textContent = "다른 카드에는 뭐가 있었을까요?";

      const others = Array.from(grid.children).filter((c) => c !== cardEl);
      others.forEach((cardEl2, i) => {
        setTimeout(() => {
          const value2 = cardEl2.dataset.value;
          revealCard(cardEl2, value2, false);
          if (flippedCount === shuffledOptions.length) {
            setTimeout(() => {
              const isLast = flow.catIndex === flow.catOrder.length - 1;
              confirmBtn.textContent = isLast ? "결과 보기 🎉" : "선택 확정하기 ➡️";
              actionRow.hidden = false;
            }, 400);
          }
        }, 260 + i * 220);
      });
    };

    shuffledOptions.forEach((option, i) => {
      const card = el("div", "tarot-card");
      card.dataset.value = option;
      card.style.animationDelay = `${i * 60}ms`;
      card.innerHTML = `
        <div class="tarot-card-inner">
          <div class="tarot-face tarot-back">
            <span class="tarot-back-icon">${cat.icon}</span>
            <span class="tarot-back-sparkle">✦</span>
          </div>
          <div class="tarot-face tarot-front">
            <span class="pick-badge">내 선택</span>
            <span class="value"></span>
          </div>
        </div>
      `;
      card.addEventListener("click", () => onPick(card, option));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    const dots = el("div", "wc-progress");
    flow.catOrder.forEach((id, i) => {
      const dot = el("span", "wc-dot");
      if (i < flow.catIndex) dot.classList.add("done");
      if (i === flow.catIndex) dot.classList.add("current");
      dots.appendChild(dot);
    });
    wrap.appendChild(dots);

    const actionRow = el("div", "btn-row");
    actionRow.hidden = true;
    actionRow.style.marginTop = "20px";

    const redrawBtn = el("button", "btn btn-ghost", "🔄 다시 뽑기");
    redrawBtn.addEventListener("click", () => {
      delete state.results[catId];
      render();
    });

    const confirmBtn = el("button", "btn btn-primary", "선택 확정하기 ➡️");
    confirmBtn.addEventListener("click", () => {
      flow.catIndex += 1;
      if (flow.catIndex >= flow.catOrder.length) {
        state.screen = "result";
      }
      render();
    });

    actionRow.appendChild(redrawBtn);
    actionRow.appendChild(confirmBtn);
    wrap.appendChild(actionRow);

    return wrap;
  }

  // ---------- worldcup ----------

  function setupWorldcupRound(newCategory) {
    const wc = state.wc;
    if (newCategory) {
      const catId = wc.catOrder[wc.catIndex];
      const cat = CATEGORY_MAP[catId];
      wc.pool = shuffle(cat.options).slice(0, 8);
      wc.winners = [];
      wc.matchIndex = 0;
    }
  }

  function currentWcCategory() {
    return CATEGORY_MAP[state.wc.catOrder[state.wc.catIndex]];
  }

  function roundLabel(poolSize) {
    if (poolSize >= 8) return "8강";
    if (poolSize === 4) return "4강";
    if (poolSize === 2) return "결승";
    return `${poolSize}강`;
  }

  function renderWorldcupScreen() {
    const wc = state.wc;
    const cat = currentWcCategory();
    const pool = wc.pool;
    const matchA = pool[wc.matchIndex * 2];
    const matchB = pool[wc.matchIndex * 2 + 1];
    const totalMatchesThisRound = pool.length / 2;

    const wrap = el("div", "screen");
    wrap.appendChild(
      renderBackRow(() => {
        state.screen = "categories";
        render();
      }, ((wc.catIndex) / wc.catOrder.length) * 100)
    );

    wrap.appendChild(el("div", "wc-round-label", `${cat.icon} ${cat.label} · ${roundLabel(pool.length)} (${wc.matchIndex + 1}/${totalMatchesThisRound})`));
    wrap.appendChild(el("h2", "wc-category-label", "마음이 가는 쪽은?"));

    const arena = el("div", "wc-arena");
    const cardA = el("button", "wc-card");
    cardA.innerHTML = `<span class="emoji">${cat.icon}</span><span class="name">${matchA}</span>`;
    const cardB = el("button", "wc-card");
    cardB.innerHTML = `<span class="emoji">${cat.icon}</span><span class="name">${matchB}</span>`;
    const vs = el("div", "wc-vs", "VS");

    const pick = (winnerEl, loserEl, winnerText) => {
      winnerEl.classList.add("picked");
      loserEl.classList.add("rejected");
      arena.style.pointerEvents = "none";
      wc.winners.push(winnerText);
      setTimeout(() => advanceWorldcup(), 480);
    };

    cardA.addEventListener("click", () => pick(cardA, cardB, matchA));
    cardB.addEventListener("click", () => pick(cardB, cardA, matchB));

    arena.appendChild(cardA);
    arena.appendChild(vs);
    arena.appendChild(cardB);
    wrap.appendChild(arena);

    const dots = el("div", "wc-progress");
    wc.catOrder.forEach((id, i) => {
      const dot = el("span", "wc-dot");
      if (i < wc.catIndex) dot.classList.add("done");
      if (i === wc.catIndex) dot.classList.add("current");
      dots.appendChild(dot);
    });
    wrap.appendChild(dots);

    return wrap;
  }

  function advanceWorldcup() {
    const wc = state.wc;
    wc.matchIndex += 1;
    const totalMatches = wc.pool.length / 2;

    if (wc.matchIndex < totalMatches) {
      render();
      return;
    }

    // round complete
    if (wc.winners.length === 1) {
      const catId = wc.catOrder[wc.catIndex];
      state.results[catId] = wc.winners[0];
      wc.catIndex += 1;
      if (wc.catIndex >= wc.catOrder.length) {
        state.screen = "result";
        render();
        return;
      }
      setupWorldcupRound(true);
      render();
      return;
    }

    wc.pool = wc.winners;
    wc.winners = [];
    wc.matchIndex = 0;
    render();
  }

  // ---------- result ----------

  function renderResultScreen() {
    const wrap = el("div", "screen");
    const hero = el("div", "result-hero");
    hero.innerHTML = `<span class="emoji">🎉</span>`;
    hero.appendChild(el("h1", "title", "오늘의 데이트 코스<br/>완성!"));
    if (state.sharedView) {
      wrap.appendChild(el("p", "shared-badge", "누군가 공유한 데이트 코스예요 💌"));
    } else {
      hero.appendChild(el("p", "subtitle", "이대로 오늘 하루를 채워보세요."));
    }
    wrap.appendChild(hero);

    const list = el("div", "result-list");
    const order = state.sharedView ? Object.keys(state.results) : state.selected;
    order.forEach((id, i) => {
      const cat = CATEGORY_MAP[id];
      if (!cat) return;
      const item = el("div", "result-item");
      item.style.animationDelay = `${i * 70}ms`;
      item.innerHTML = `
        <span class="icon">${cat.icon}</span>
        <div class="body">
          <div class="label">${cat.label}</div>
          <div class="value">${state.results[id]}</div>
        </div>
      `;
      list.appendChild(item);
    });
    wrap.appendChild(list);

    const saveBtn = el("button", "btn btn-save", "📥 결과 저장하기");
    saveBtn.style.width = "100%";
    saveBtn.style.marginBottom = "12px";
    saveBtn.addEventListener("click", () => {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        savedAt: new Date().toISOString(),
        mode: state.mode,
        selected: state.selected.slice(),
        results: { ...state.results },
      };
      const ok = saveHistoryEntry(entry);
      if (ok) {
        saveBtn.textContent = "✓ 저장 완료";
        saveBtn.disabled = true;
        showToast("오늘의 코스를 저장했어요!");
      } else {
        showToast("저장에 실패했어요. 브라우저 저장공간을 확인해주세요.");
      }
    });
    wrap.appendChild(saveBtn);

    const shareRow = el("div", "share-row");
    const kakaoBtn = el("button", "btn btn-kakao", "💬 카카오톡 공유");
    kakaoBtn.addEventListener("click", async () => {
      const url = buildShareUrl();
      const text = "오늘 데이트 코스 이걸로 어때? 💕";
      if (navigator.share) {
        try {
          await navigator.share({ title: "오늘의 데이트 코스", text, url });
          return;
        } catch (e) {
          /* user cancelled or unsupported, fall through to copy */
        }
      }
      const ok = await copyText(`${text}\n${url}`);
      showToast(ok ? "링크를 복사했어요! 카톡에 붙여넣기 해보세요 💬" : "복사에 실패했어요. 직접 복사해주세요.");
    });

    const copyBtn = el("button", "btn btn-copy", "🔗 결과 링크 복사");
    copyBtn.addEventListener("click", async () => {
      const ok = await copyText(buildShareUrl());
      showToast(ok ? "링크가 복사되었어요!" : "복사에 실패했어요.");
    });

    shareRow.appendChild(kakaoBtn);
    shareRow.appendChild(copyBtn);
    wrap.appendChild(shareRow);

    const restartBtn = el("button", "btn btn-ghost", "🔄 다시 정하기");
    restartBtn.style.width = "100%";
    restartBtn.addEventListener("click", () => {
      history.replaceState(null, "", location.pathname);
      state.screen = "mode";
      state.mode = null;
      state.selected = [];
      state.results = {};
      state.wc = null;
      state.sharedView = false;
      render();
    });
    wrap.appendChild(restartBtn);

    return wrap;
  }

  // ---------- boot ----------

  function boot() {
    const shared = readSharedFromUrl();
    if (shared) {
      state.selected = shared.s;
      state.results = shared.r;
      state.sharedView = true;
      state.screen = "result";
    }
    render();
  }

  boot();
})();
