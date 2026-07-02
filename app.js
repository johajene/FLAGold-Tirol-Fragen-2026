const DATA_URL = "questions.json";
const PASS_RATE = 0.8;
const EXAM_SIZE = 30;
const STORAGE_KEY = "fwQuizProgress.v1";

const appState = {
  quiz: null,
  questions: [],
  screen: "home",
  session: null,
  progress: loadProgress(),
};

const $ = (selector, root = document) => root.querySelector(selector);
const screen = $("#screen");
const pageTitle = $("#pageTitle");
const backBtn = $("#backBtn");
const menuBtn = $("#menuBtn");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  registerServiceWorker();

  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Fragen konnten nicht geladen werden (${response.status}).`);
    appState.quiz = await response.json();
    appState.questions = appState.quiz.sections?.[0]?.questions ?? [];
    if (!appState.questions.length) throw new Error("Die JSON-Datei enthält keine Fragen.");
    showHome();
  } catch (error) {
    showLoadError(error);
  }

  backBtn.addEventListener("click", showHome);
  menuBtn.addEventListener("click", showHome);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Die App funktioniert auch ohne Service Worker, dann jedoch nicht als echte Offline-PWA.
    });
  }
}

function showLoadError(error) {
  pageTitle.textContent = "Fehler";
  backBtn.classList.add("hidden");
  screen.innerHTML = `
    <section class="card error">
      <h2>Fragen konnten nicht geladen werden</h2>
      <p class="muted">${escapeHtml(error.message)}</p>
      <p class="muted">Öffne die App über einen Webserver oder eine HTTPS-Adresse. Direktes Öffnen aus dem Dateisystem kann je nach Browser blockiert werden.</p>
    </section>
  `;
}

function showHome() {
  appState.screen = "home";
  appState.session = null;
  pageTitle.textContent = "LernApp";
  backBtn.classList.add("hidden");

  screen.replaceChildren(document.importNode($("#homeTemplate").content, true));

  const summary = getSummary();
  $("#homeAnswered").textContent = summary.answeredQuestions;
  $("#mistakeCount").textContent = appState.progress.mistakes.length;

  screen.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "practice") startPractice();
      if (action === "exam") startExam();
      if (action === "mistakes") startMistakes();
      if (action === "stats") showStats();
    });
  });
}

function startPractice(questionSet = null, title = "Übungsmodus") {
  const questions = shuffle([...(questionSet ?? appState.questions)]);
  if (!questions.length) {
    showEmptyMistakes();
    return;
  }

  appState.session = {
    type: "practice",
    title,
    questions,
    index: 0,
    answers: [],
    currentOptions: [],
    locked: false,
  };
  showQuiz();
}

function startExam() {
  const questions = shuffle([...appState.questions]).slice(0, Math.min(EXAM_SIZE, appState.questions.length));
  appState.session = {
    type: "exam",
    title: "Prüfungsmodus",
    questions,
    index: 0,
    answers: [],
    currentOptions: [],
    locked: false,
  };
  showQuiz();
}

function startMistakes() {
  const mistakeIds = new Set(appState.progress.mistakes);
  const questions = appState.questions.filter((q) => mistakeIds.has(String(q.id)));
  if (!questions.length) {
    showEmptyMistakes();
    return;
  }
  startPractice(questions, "Fehlertraining");
  appState.session.type = "mistakes";
}

function showEmptyMistakes() {
  pageTitle.textContent = "Fehlertraining";
  backBtn.classList.remove("hidden");
  screen.innerHTML = `
    <section class="card">
      <p class="eyebrow">Fehlertraining</p>
      <h2>Keine Fragen auf der Fehlerliste</h2>
      <p class="muted">Falsch beantwortete Fragen werden automatisch hier gesammelt.</p>
      <button class="primary" id="emptyPracticeBtn">Übungsmodus starten</button>
    </section>
  `;
  $("#emptyPracticeBtn").addEventListener("click", () => startPractice());
}

function showQuiz() {
  const session = appState.session;
  const question = session.questions[session.index];

  pageTitle.textContent = session.title;
  backBtn.classList.remove("hidden");
  screen.replaceChildren(document.importNode($("#quizTemplate").content, true));

  $("#modeBadge").textContent = session.type === "exam" ? "Prüfung" : session.type === "mistakes" ? "Fehlertraining" : "Üben";
  $("#counter").textContent = `${session.index + 1} / ${session.questions.length}`;
  $("#progressBar").style.width = `${(session.index / session.questions.length) * 100}%`;
  $("#questionNumber").textContent = `Frage ${question.id}`;
  $("#questionText").textContent = question.question;

  session.currentOptions = shuffle([...question.options]);
  session.locked = false;

  const optionsEl = $("#options");
  session.currentOptions.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.type = "button";
    btn.innerHTML = `
      <span class="option-letter">${String.fromCharCode(65 + index)}</span>
      <span>${escapeHtml(option)}</span>
    `;
    btn.addEventListener("click", () => selectAnswer(option, btn));
    optionsEl.appendChild(btn);
  });

  $("#nextBtn").addEventListener("click", nextQuestion);
  $("#finishBtn").addEventListener("click", finishSession);

  if (session.type === "exam") {
    $("#feedback").classList.add("hidden");
  }
}

function selectAnswer(answer, button) {
  const session = appState.session;
  if (!session || session.locked) return;

  const question = session.questions[session.index];
  const isCorrect = answer === question.correctAnswer;

  session.answers[session.index] = {
    questionId: String(question.id),
    selected: answer,
    correct: question.correctAnswer,
    isCorrect,
  };

  updateQuestionProgress(question, isCorrect);

  if (session.type === "exam") {
    session.locked = true;
    button.classList.add("selected");
    disableOptions();
    if (session.index === session.questions.length - 1) {
      $("#finishBtn").classList.remove("hidden");
    } else {
      $("#nextBtn").classList.remove("hidden");
    }
    return;
  }

  session.locked = true;
  markOptions(answer, question.correctAnswer);
  showFeedback(isCorrect, question.correctAnswer, question.explanation);

  if (session.index === session.questions.length - 1) {
    $("#finishBtn").classList.remove("hidden");
  } else {
    $("#nextBtn").classList.remove("hidden");
  }
}

function markOptions(selected, correct) {
  document.querySelectorAll(".option-btn").forEach((btn) => {
    const text = btn.textContent.slice(1).trim();
    btn.disabled = true;
    if (text === correct) btn.classList.add("correct");
    if (text === selected && selected !== correct) btn.classList.add("wrong");
  });
}

function disableOptions() {
  document.querySelectorAll(".option-btn").forEach((btn) => {
    btn.disabled = true;
  });
}

function showFeedback(isCorrect, correctAnswer, explanation) {
  const feedback = $("#feedback");
  feedback.classList.remove("hidden", "ok", "bad");
  feedback.classList.add(isCorrect ? "ok" : "bad");

  const explanationText = explanation && explanation.trim() ? `<p>${escapeHtml(explanation)}</p>` : "";
  feedback.innerHTML = isCorrect
    ? `<strong>Richtig.</strong>${explanationText}`
    : `<strong>Falsch.</strong><br>Richtig wäre: ${escapeHtml(correctAnswer)}${explanationText}`;
}

function nextQuestion() {
  const session = appState.session;
  if (!session) return;
  if (session.index < session.questions.length - 1) {
    session.index += 1;
    showQuiz();
  } else {
    finishSession();
  }
}

function finishSession() {
  const session = appState.session;
  if (!session) return;

  const answered = session.answers.filter(Boolean);
  const correct = answered.filter((a) => a.isCorrect).length;
  const total = session.questions.length;
  const percent = total ? correct / total : 0;
  const passed = percent >= PASS_RATE;

  if (session.type === "exam") {
    appState.progress.exams.unshift({
      date: new Date().toISOString(),
      score: correct,
      total,
      percent: Math.round(percent * 100),
      passed,
    });
    appState.progress.exams = appState.progress.exams.slice(0, 20);
    saveProgress();
  }

  pageTitle.textContent = "Auswertung";
  backBtn.classList.remove("hidden");
  screen.replaceChildren(document.importNode($("#resultTemplate").content, true));

  $("#resultMode").textContent = session.title;
  $("#resultTitle").textContent = session.type === "exam"
    ? passed ? "Bestanden" : "Nicht bestanden"
    : "Durchgang beendet";
  $("#resultPercent").textContent = `${Math.round(percent * 100)} %`;
  $("#resultScore").textContent = `${correct} von ${total} Punkten`;
  $("#resultText").textContent = session.type === "exam"
    ? `Bestehensgrenze: 80 % (${Math.ceil(total * PASS_RATE)} von ${total} Punkten).`
    : `Falsch beantwortete Fragen wurden in die Fehlerliste übernommen.`;

  const wrongIds = answered.filter((a) => !a.isCorrect).map((a) => a.questionId);
  const repeatWrongBtn = screen.querySelector("[data-action='repeat-wrong']");
  repeatWrongBtn.disabled = wrongIds.length === 0;
  repeatWrongBtn.textContent = wrongIds.length ? "Falsche Fragen üben" : "Keine falschen Fragen";

  screen.querySelector("[data-action='repeat-wrong']").addEventListener("click", () => {
    const wrongSet = new Set(wrongIds);
    startPractice(appState.questions.filter((q) => wrongSet.has(String(q.id))), "Fehler wiederholen");
  });
  screen.querySelector("[data-action='restart']").addEventListener("click", () => {
    if (session.type === "exam") startExam();
    else if (session.type === "mistakes") startMistakes();
    else startPractice();
  });
  screen.querySelector("[data-action='home']").addEventListener("click", showHome);
}

function showStats() {
  pageTitle.textContent = "Statistik";
  backBtn.classList.remove("hidden");
  screen.replaceChildren(document.importNode($("#statsTemplate").content, true));

  const summary = getSummary();
  $("#statsAnswered").textContent = summary.answeredQuestions;
  $("#statsCorrectRate").textContent = `${summary.correctRate}%`;
  $("#statsMistakes").textContent = appState.progress.mistakes.length;
  $("#statsExams").textContent = appState.progress.exams.length;

  renderExamHistory();
  renderMistakeList();

  $("#resetBtn").addEventListener("click", () => {
    const ok = confirm("Fortschritt wirklich löschen?");
    if (!ok) return;
    appState.progress = defaultProgress();
    saveProgress();
    showStats();
  });
}

function renderExamHistory() {
  const container = $("#examHistory");
  const exams = appState.progress.exams;

  if (!exams.length) {
    container.textContent = "Noch keine Prüfungen durchgeführt.";
    return;
  }

  container.classList.remove("muted");
  container.innerHTML = "";
  exams.slice(0, 8).forEach((exam) => {
    const date = new Date(exam.date);
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <strong>${exam.passed ? "Bestanden" : "Nicht bestanden"} · ${exam.percent}%</strong>
      <div class="muted">${exam.score}/${exam.total} Punkte · ${date.toLocaleString("de-AT")}</div>
    `;
    container.appendChild(item);
  });
}

function renderMistakeList() {
  const container = $("#mistakeList");
  const mistakeIds = new Set(appState.progress.mistakes);
  const mistakes = appState.questions.filter((q) => mistakeIds.has(String(q.id)));

  if (!mistakes.length) {
    container.textContent = "Keine Fragen auf der Fehlerliste.";
    return;
  }

  container.classList.remove("muted");
  container.innerHTML = "";

  mistakes.slice(0, 20).forEach((q) => {
    const stats = appState.progress.byQuestion[String(q.id)] ?? {};
    const item = document.createElement("div");
    item.className = "mistake-item";
    item.innerHTML = `
      <strong>Frage ${escapeHtml(String(q.id))}</strong>
      <div>${escapeHtml(q.question)}</div>
      <div class="muted">Falsch beantwortet: ${stats.wrong ?? 0}×</div>
    `;
    container.appendChild(item);
  });

  if (mistakes.length > 20) {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = `Weitere ${mistakes.length - 20} Fragen sind ebenfalls auf der Fehlerliste.`;
    container.appendChild(info);
  }
}

function updateQuestionProgress(question, isCorrect) {
  const id = String(question.id);
  const stats = appState.progress.byQuestion[id] ?? {
    seen: 0,
    correct: 0,
    wrong: 0,
    lastAnswerCorrect: null,
    lastSeen: null,
  };

  stats.seen += 1;
  stats.lastAnswerCorrect = isCorrect;
  stats.lastSeen = new Date().toISOString();

  if (isCorrect) {
    stats.correct += 1;
    if (appState.session?.type === "mistakes") {
      appState.progress.mistakes = appState.progress.mistakes.filter((mistakeId) => mistakeId !== id);
    }
  } else {
    stats.wrong += 1;
    if (!appState.progress.mistakes.includes(id)) {
      appState.progress.mistakes.push(id);
    }
  }

  appState.progress.byQuestion[id] = stats;
  saveProgress();
}

function getSummary() {
  const values = Object.values(appState.progress.byQuestion);
  const answeredQuestions = values.filter((q) => q.seen > 0).length;
  const correctTotal = values.reduce((sum, q) => sum + (q.correct ?? 0), 0);
  const answeredTotal = values.reduce((sum, q) => sum + (q.correct ?? 0) + (q.wrong ?? 0), 0);
  const correctRate = answeredTotal ? Math.round((correctTotal / answeredTotal) * 100) : 0;

  return {
    answeredQuestions,
    answeredTotal,
    correctTotal,
    correctRate,
  };
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return {
      byQuestion: parsed.byQuestion ?? {},
      mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes.map(String) : [],
      exams: Array.isArray(parsed.exams) ? parsed.exams : [],
    };
  } catch {
    return defaultProgress();
  }
}

function defaultProgress() {
  return {
    byQuestion: {},
    mistakes: [],
    exams: [],
  };
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.progress));
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
