const FastMutex = require("./");

const readableTime = (date) => date.toTimeString().split(" ")[0];
const readableTimeMs = (date) => `${readableTime(date)}.${date.getMilliseconds()}`;

//// Helpers
let currentRun;
const addRunLog = (runDate) => {
  currentRun = document.createElement("details");
  currentRun.summary = document.createElement("summary");
  currentRun.summary.innerText = `Run: ${readableTime(runDate)}`;
  currentRun.setAttribute("open", "open");
  currentRun.appendChild(currentRun.summary);

  document.body.appendChild(currentRun);
  currentRun.setAttribute("class", "run");
};
const closeRunLog = (pass, summaryText) => {
  currentRun.setAttribute("class", `run ${pass ? "pass" : "fail"}`);
  currentRun.summary.innerText += ` - ${summaryText}`;
  currentRun.removeAttribute("open");
  currentRun = null;
};
const bgColor = (color) => currentRun.style = `background:${color}`;

const log = (...text) => {
  text = text.join(" ");
  const div = document.createElement("div");
  div.innerText = text;
  if (currentRun) {
    currentRun.appendChild(div);
  } else {
    document.body.appendChild(div);
  }
  console.log(text);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const resolveAt = (date) => delay(date.getTime() - Date.now()).then(() => date);

// round a date to the next :00/:15/:30/:45
const roundDateToNext15s = (date) => {
  date.setMilliseconds(0);

  const s = date.getSeconds();

  if (s < 15) {
    date.setSeconds(15);
  } else if (s < 30) {
    date.setSeconds(30);
  } else if (s < 45) {
    date.setSeconds(45);
  } else {
    date.setSeconds(0);
    date.setMinutes(date.getMinutes() + 1);
  }

  return date;
};


//// Initialisation
const tabId = "tab-" + Math.floor(Math.random() * 10000);
log("This is tab: " + tabId);

const counterKey = (runDate) => `${runDate.getTime()}-counter`;
const setCounter = (runDate, value) => localStorage.setItem(counterKey(runDate), value);
const getCounter = (runDate) => ~~localStorage.getItem(counterKey(runDate));
const removeCounter = (runDate) => localStorage.removeItem(counterKey(runDate));

const tabKey = (runDate) => `${runDate.getTime()}-${tabId}`;
const setTabStarted = (runDate) => localStorage.setItem(tabKey(runDate), "started");
const setTabCompleted = (runDate) => localStorage.setItem(tabKey(runDate), "completed");
const getTabKeys = (runDate) => Object.keys(localStorage).filter(k => k.indexOf(`${runDate.getTime()}-tab-`) === 0);
const waitUntilAllTabsCompleted = (runDate) => {
  return new Promise((resolve) => {
    const int = setInterval(() => {
      const tabs = getTabKeys(runDate);
      if (tabs.every(t => localStorage.getItem(t) === "completed")) {
        clearInterval(int);
        resolve(tabs);
      }
    }, 100);
  });
};


const run = () => {
  Promise.resolve()
    .then(() => {
      const now = new Date();
      const runDate = roundDateToNext15s(now);
      addRunLog(runDate);
      log(`Runid: ${runDate.getTime()}`);
      log("Run will start at", readableTime(runDate));

      setCounter(runDate, 0);

      return resolveAt(runDate);
    })
    .then((runDate) => {
      log("Started run at", readableTimeMs(new Date()));
      bgColor("yellow");
      setTabStarted(runDate);

      return runDate;
    }).then((runDate) => {
      const mutex = new FastMutex();

      return mutex.lock("the-lock").then(() => {
        log("  - Got the lock at", readableTimeMs(new Date()));
        bgColor("coral");
        const counterValue = getCounter(runDate);
        log("  - Got counter value", counterValue);

        return delay(35).then(() => {
          log("  - Set counter value", counterValue + 1);
          setCounter(runDate, counterValue + 1)
        });
      })
      .then(() => mutex.release("the-lock"))
      .then(() => {
        bgColor("white");
        log("Finished run at", readableTimeMs(new Date()));
        setTabCompleted(runDate);
      })
      .then(() => {
        log("Waiting till all tabs finished");
        return waitUntilAllTabsCompleted(runDate);
      })
      .then((tabs) => {
        const pass = getCounter(runDate) === tabs.length;
        const passText = pass ? "PASS" : "FAIL";
        const finalCounter = getCounter(runDate);

        log(passText);
        log("Final counter value was:", finalCounter);
        log("Number of tabs in run:", tabs.length);
        closeRunLog(pass, `${passText} - (${tabs.length} tabs in run, counter was ${finalCounter})`);
      })
      .then(() => delay(2000))
      .then(() => {
        removeCounter(runDate);
        getTabKeys(runDate).forEach(k => localStorage.removeItem(k));
      })
      .catch((err) => {
        bgColor("white");
        setTabCompleted(runDate);
        log("Failed run with error at", readableTimeMs(new Date()));
        log("Error:", err);
        log("FAIL");
        closeRunLog(false, `FAIL - Error: ${err}`);
      })
    })
    .then(() => run());
};

run();
