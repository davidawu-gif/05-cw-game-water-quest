const STORAGE_KEY = "globalGardenState_v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CROPS = 5;

const demoPlayers = [
	{ name: "Ari", score: 16, donations: 3 },
	{ name: "Noel", score: 24, donations: 1 },
	{ name: "Sky", score: 12, donations: 9 },
	{ name: "Rin", score: 31, donations: 4 }
];

const state = {
	started: false,
	simulatedNow: Date.now(),
	globalNoAccessPercent: 26,
	previousGlobalNoAccessPercent: 26,
	score: 0,
	donations: 0,
	activeTool: "seed",
	firstWitherMessageShown: false,
	crops: new Array(MAX_CROPS).fill(null)
};

let refreshNonce = 0;

const els = {
	globalPercent: document.getElementById("globalPercent"),
	worldCondition: document.getElementById("worldCondition"),
	simDate: document.getElementById("simDate"),
	scoreValue: document.getElementById("scoreValue"),
	donationValue: document.getElementById("donationValue"),
	startBtn: document.getElementById("startBtn"),
	donateBtn: document.getElementById("donateBtn"),
	advanceDayBtn: document.getElementById("advanceDayBtn"),
	resetGameBtn: document.getElementById("resetGameBtn"),
	refreshGlobalBtn: document.getElementById("refreshGlobalBtn"),
	feedbackText: document.getElementById("feedbackText"),
	hintText: document.getElementById("hintText"),
	gardenGrid: document.getElementById("gardenGrid"),
	scoreBoard: document.getElementById("scoreBoard"),
	donationBoard: document.getElementById("donationBoard"),
	toolButtons: Array.from(document.querySelectorAll(".tool-btn"))
};

function saveState() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (!saved) {
		return;
	}

	try {
		const parsed = JSON.parse(saved);
		state.started = Boolean(parsed.started);
		state.simulatedNow = Number(parsed.simulatedNow) || Date.now();
		state.globalNoAccessPercent = Number(parsed.globalNoAccessPercent) || 26;
		state.previousGlobalNoAccessPercent = Number(parsed.previousGlobalNoAccessPercent) || state.globalNoAccessPercent;
		state.score = Number(parsed.score) || 0;
		state.donations = Number(parsed.donations) || 0;
		state.activeTool = ["seed", "water", "hand"].includes(parsed.activeTool) ? parsed.activeTool : "seed";
		state.firstWitherMessageShown = Boolean(parsed.firstWitherMessageShown);

		if (Array.isArray(parsed.crops) && parsed.crops.length === MAX_CROPS) {
			state.crops = parsed.crops.map((crop) => {
				if (!crop) return null;

				return {
					id: crop.id,
					stage: Number(crop.stage) || 0,
					isDead: Boolean(crop.isDead),
					lastWateredAt: crop.lastWateredAt ? Number(crop.lastWateredAt) : null
				};
			});
		}
	} catch {
		localStorage.removeItem(STORAGE_KEY);
	}
}

function setFeedback(message) {
	els.feedbackText.textContent = message;
}

function formatDate(ms) {
	return new Date(ms).toLocaleString();
}

function isHarvestable(crop) {
	return crop && !crop.isDead && crop.stage >= 5;
}

function isWaterReady(crop) {
	if (!crop || crop.isDead || crop.stage >= 5) return false;
	if (!crop.lastWateredAt) return true;
	return state.simulatedNow - crop.lastWateredAt >= DAY_MS;
}

function getToolHint() {
	if (state.activeTool === "seed") {
		return "Plant tool: tap an empty tile to plant a seed.";
	}
	if (state.activeTool === "water") {
		return "Water tool: tap a crop that is ready for watering.";
	}
	return "Hand tool: harvest stage-5 crops or clear dead crops.";
}

function updateWorldConditionText() {
	const current = state.globalNoAccessPercent;
	const previous = state.previousGlobalNoAccessPercent;

	if (current > previous) {
		els.worldCondition.textContent = "Global alert: access worsened since last check. Everybody loses when this rises.";
		return;
	}

	if (current < previous) {
		els.worldCondition.textContent = "Global win: more people have clean water than last check.";
		return;
	}

	els.worldCondition.textContent = "No global change since last check. Keep awareness growing.";
}

function createTile(index) {
	const tile = document.createElement("button");
	tile.type = "button";
	tile.className = "garden-tile";
	tile.setAttribute("aria-label", `Garden tile ${index + 1}`);
	tile.addEventListener("click", () => handleTileAction(index));
	return tile;
}

function cropVisualEmoji(crop) {
	if (crop.isDead) return "☠️";
	if (crop.stage >= 5) return "🥕";
	if (crop.stage >= 4) return "🌿";
	if (crop.stage >= 2) return "🌱";
	return "·";
}

function renderGarden() {
	els.gardenGrid.innerHTML = "";
	state.crops.forEach((crop, index) => {
		const tile = createTile(index);

		if (crop) {
			const cropEl = document.createElement("div");
			cropEl.className = `crop ${crop.isDead ? "dead" : `stage-${Math.min(crop.stage, 5)}`}`;
			cropEl.textContent = cropVisualEmoji(crop);
			tile.appendChild(cropEl);

			const tag = document.createElement("span");
			if (crop.isDead) {
				tag.className = "dead-tag";
				tag.textContent = "Dead";
			} else if (crop.stage >= 5) {
				tag.className = "ready-tag";
				tag.textContent = "Harvest";
			} else if (isWaterReady(crop)) {
				tag.className = "ready-tag";
				tag.textContent = "Water Ready";
			} else {
				tag.className = "cooldown-tag";
				tag.textContent = "Cooling";
			}
			tile.appendChild(tag);
		}

		els.gardenGrid.appendChild(tile);
	});
}

function renderLeaderboards() {
	const combined = [...demoPlayers, { name: "You", score: state.score, donations: state.donations }];

	const byScore = [...combined]
		.sort((a, b) => b.score - a.score)
		.slice(0, 5);

	const byDonations = [...combined]
		.sort((a, b) => b.donations - a.donations)
		.slice(0, 5);

	els.scoreBoard.innerHTML = "";
	byScore.forEach((entry) => {
		const li = document.createElement("li");
		li.textContent = `${entry.name}: ${entry.score}`;
		els.scoreBoard.appendChild(li);
	});

	els.donationBoard.innerHTML = "";
	byDonations.forEach((entry) => {
		const li = document.createElement("li");
		li.textContent = `${entry.name}: ${entry.donations}`;
		els.donationBoard.appendChild(li);
	});
}

function renderStatus() {
	els.globalPercent.textContent = String(state.globalNoAccessPercent);
	els.simDate.textContent = formatDate(state.simulatedNow);
	els.scoreValue.textContent = String(state.score);
	els.donationValue.textContent = String(state.donations);
	els.hintText.textContent = getToolHint();
	updateWorldConditionText();

	els.toolButtons.forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.tool === state.activeTool);
	});
}

function renderAll() {
	renderStatus();
	renderGarden();
	renderLeaderboards();
}

function plantSeed(index) {
	if (state.crops[index]) {
		setFeedback("That tile is occupied.");
		return;
	}

	const plantedCount = state.crops.filter(Boolean).length;
	if (plantedCount >= MAX_CROPS) {
		setFeedback("Your garden is full. Harvest or clear a crop first.");
		return;
	}

	state.crops[index] = {
		id: `${state.simulatedNow}-${index}`,
		stage: 0,
		isDead: false,
		lastWateredAt: null
	};
	setFeedback("Seed planted.");
}

function waterCrop(index) {
	const crop = state.crops[index];
	if (!crop) {
		setFeedback("No crop here to water.");
		return;
	}

	if (crop.isDead) {
		setFeedback("This crop is dead. Clear it with the hand tool.");
		return;
	}

	if (crop.stage >= 5) {
		setFeedback("This crop is ready to harvest.");
		return;
	}

	if (!isWaterReady(crop)) {
		setFeedback("This crop was recently watered. Advance +24h in debug mode.");
		return;
	}

	crop.stage += 1;
	crop.lastWateredAt = state.simulatedNow;
	if (crop.stage >= 5) {
		setFeedback("Crop is fully grown and ready to harvest.");
	} else {
		setFeedback(`Crop watered. Growth stage is now ${crop.stage}/5.`);
	}
}

function handAction(index) {
	const crop = state.crops[index];
	if (!crop) {
		setFeedback("No crop to harvest or clear.");
		return;
	}

	if (crop.isDead) {
		state.crops[index] = null;
		setFeedback("Dead crop removed.");
		return;
	}

	if (isHarvestable(crop)) {
		state.crops[index] = null;
		state.score += 1;
		setFeedback("Harvest complete. Score +1.");
		return;
	}

	setFeedback("This crop is not ready to harvest.");
}

function handleTileAction(index) {
	if (!state.started) {
		setFeedback("Press Load Garden to start.");
		return;
	}

	if (state.activeTool === "seed") {
		plantSeed(index);
	} else if (state.activeTool === "water") {
		waterCrop(index);
	} else {
		handAction(index);
	}

	saveState();
	renderAll();
}

function applyDailyWitherRoll() {
	let witheredToday = 0;
	state.crops.forEach((crop) => {
		if (!crop || crop.isDead || crop.stage >= 5) return;
		const roll = Math.random() * 100;
		if (roll < state.globalNoAccessPercent) {
			crop.isDead = true;
			witheredToday += 1;
		}
	});

	if (witheredToday > 0 && !state.firstWitherMessageShown) {
		state.firstWitherMessageShown = true;
		alert("A crop withered. Consider donating to charity: water to support clean water access worldwide.");
	}

	if (witheredToday > 0) {
		setFeedback(`${witheredToday} crop(s) withered after day change.`);
	} else {
		setFeedback("Day advanced. No crops withered this time.");
	}
}

function advanceDay() {
	if (!state.started) {
		setFeedback("Press Load Garden first.");
		return;
	}

	state.simulatedNow += DAY_MS;
	applyDailyWitherRoll();
	saveState();
	renderAll();
}

function resetGame() {
	const shouldReset = window.confirm("Reset all game progress? This clears score, crops, and saved progress.");
	if (!shouldReset) {
		return;
	}

	refreshNonce += 1;

	state.started = false;
	state.simulatedNow = Date.now();
	state.globalNoAccessPercent = 26;
	state.previousGlobalNoAccessPercent = 26;
	state.score = 0;
	state.donations = 0;
	state.activeTool = "seed";
	state.firstWitherMessageShown = false;
	state.crops = new Array(MAX_CROPS).fill(null);

	saveState();
	setFeedback("Game reset complete. Press Load Garden to start again.");
	renderAll();
}

async function fetchGlobalNoAccessPercent() {
	return 26;
}

async function refreshGlobalPercent() {
	const nonceAtStart = refreshNonce;
	const fetchedPercent = await fetchGlobalNoAccessPercent();
	if (nonceAtStart !== refreshNonce) {
		return;
	}

	const clamped = Math.max(0, Math.min(100, Number(fetchedPercent) || 26));

	state.previousGlobalNoAccessPercent = state.globalNoAccessPercent;
	state.globalNoAccessPercent = clamped;
	saveState();
	renderAll();
}

function setTool(tool) {
	state.activeTool = tool;
	saveState();
	renderAll();
}

function initializeGardenSlots() {
	if (!Array.isArray(state.crops) || state.crops.length !== MAX_CROPS) {
		state.crops = new Array(MAX_CROPS).fill(null);
	}
}

function startGame() {
	state.started = true;
	setFeedback("Garden loaded. Build awareness one harvest at a time.");
	refreshGlobalPercent();
	saveState();
	renderAll();
}

function wireEvents() {
	els.startBtn.addEventListener("click", startGame);

	els.donateBtn.addEventListener("click", () => {
		state.donations += 1;
		window.open("https://www.charitywater.org/", "_blank", "noopener");
		setFeedback("Donation link opened. Thank you for supporting clean water access.");
		saveState();
		renderAll();
	});

	els.advanceDayBtn.addEventListener("click", advanceDay);
	els.resetGameBtn.addEventListener("click", resetGame);
	els.refreshGlobalBtn.addEventListener("click", async () => {
		await refreshGlobalPercent();
		setFeedback("Global percentage refreshed.");
	});

	els.toolButtons.forEach((btn) => {
		btn.addEventListener("click", () => setTool(btn.dataset.tool));
	});
}

function bootstrap() {
	loadState();
	initializeGardenSlots();
	wireEvents();
	renderAll();

	if (state.started) {
		setFeedback("Progress restored from your last session.");
	}

	setInterval(refreshGlobalPercent, 60000);
}

bootstrap();
