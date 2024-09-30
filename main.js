var currentTab = 0;
var prevTab = null;
var targetTab = null;
var log = [];
var toggle = true;

// Get Settings
chrome.storage.sync.get(["toggle"], function (result) {
	result.toggle ? (toggle = true) : (toggle = false);
	console.log("AutoPiP Enabled:", toggle);
});

chrome.tabs.onActivated.addListener(function (tab) {
	if (!toggle) return;

	console.clear();
	currentTab = tab.tabId;

	// Check for playing videos (set target)
	if (targetTab === null) {
		console.log(">> Check PiP For:", currentTab);
		chrome.scripting.executeScript(
			{ target: { tabId: currentTab }, files: ["./scripts/check-video.js"] },
			(results) => {
				console.log("Has Video:", results[0].result);
				if (results[0].result) targetTab = currentTab;
			}
		);
	}

	// Exit PiP if user is in target tab
	if (currentTab === targetTab) {
		console.log(">> Exit PiP");

		// Execute Exit PiP
		chrome.scripting.executeScript(
			{ target: { tabId: targetTab }, files: ["./scripts/pip.js"] },
			(results) => {
				console.log("PiP:", results[0].result);
				targetTab = null;
			}
		);

		// If page has a video, set targetTab
		chrome.scripting.executeScript(
			{ target: { tabId: currentTab }, files: ["./scripts/check-video.js"] },
			(results) => {
				console.log("Has Video:", results[0].result);
				if (results[0].result) targetTab = currentTab;
			}
		);
	}

	// Toggle PiP if there is a targetTab AND user is not in target tab
	if (targetTab != null && currentTab != targetTab) {
		console.log(">> (CHECK) Toggle PiP");
		chrome.scripting.executeScript(
			{ target: { tabId: targetTab }, files: ["./scripts/check-pip.js"] },
			(results) => {
				console.log("PiP Exists:", results[0].result);

				if (!results[0].result) {
					console.log(">> (ACTION) Toggle PiP");
					chrome.scripting.executeScript(
						{ target: { tabId: targetTab }, files: ["./scripts/pip.js"] },
						(results) => {
							console.log("PiP:", results[0].result);
						}
					);
				}
			}
		);
	}

	console.log("Current:", tab);
	console.log("Previous:", prevTab);
	console.log("Target:", targetTab);

	prevTab = tab.tabId;
});

// --- [ FUNCTION: Keyboard Control for Video ] --- //
function addVideoKeyboardControls() {
	document.addEventListener("keydown", (event) => {
		const video =
			document.querySelector("[__pip__]") || document.querySelector("video");

		if (!video) return;

		switch (event.keyCode) {
			case 32: // Spacebar
				event.preventDefault();
				if (video.paused) {
					video.play();
				} else {
					video.pause();
				}
				break;
			case 37: // Left Arrow (rewind)
				event.preventDefault();
				video.currentTime = Math.max(0, video.currentTime - rewindSeconds);
				break;
			case 39: // Right Arrow
				event.preventDefault();
				video.currentTime = Math.min(
					video.duration,
					video.currentTime + rewindSeconds
				);
				break;
			default:
				break;
		}
	});
}

// --- [ FUNCTION: Get Video ] --- //
function getVideos() {
	const videos = Array.from(document.querySelectorAll("video"))
		.filter((video) => video.readyState != 0)
		.filter((video) => video.disablePictureInPicture == false)
		.filter((video) => video.currentTime > 0 && !video.paused && !video.ended)
		.sort((v1, v2) => {
			const v1Rect = v1.getClientRects()[0] || { width: 0, height: 0 };
			const v2Rect = v2.getClientRects()[0] || { width: 0, height: 0 };
			return v2Rect.width * v2Rect.height - v1Rect.width * v1Rect.height;
		});

	if (videos.length === 0) return "No Video";
	return videos[0];
}

// --- [ FUNCTION: Request PiP Player ] --- //
async function requestPictureInPicture(video) {
	await video.requestPictureInPicture();
	video.setAttribute("__pip__", true);
	video.addEventListener(
		"leavepictureinpicture",
		(event) => {
			video.removeAttribute("__pip__");
		},
		{ once: true }
	);
	new ResizeObserver(maybeUpdatePictureInPictureVideo).observe(video);

	// Add keyboard controls for the video
	addVideoKeyboardControls();
}

// --- [ FUNCTION: Exit PiP ] --- //
function exitPictureInPicture() {
	try {
		if (!document.pictureInPictureElement) return false;
		document.exitPictureInPicture().then(() => {});
	} catch (error) {}
	return true;
}

// --- [ EXECUTE ] --- //
(async () => {
	const video = getVideos();
	if (!video) return false;

	if (video.hasAttribute("__pip__")) {
		exitPictureInPicture();
		return "Exit";
	}

	await requestPictureInPicture(video);
	return true;
})();
