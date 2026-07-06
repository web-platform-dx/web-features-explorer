addEventListener("DOMContentLoaded", () => {
  const START_TYPING_MESSAGE = "Start typing to find features...";
  const SEARCHING_MESSAGE = "Searching ...";
  const NO_RESULTS_MESSAGE = "No matching features found.";
  const UNAVAILABLE_MESSAGE = "Search is unavailable right now.";
  const MINIMUM_QUERY_LENGTH = 2;
  const MAX_RESULTS = 10;

  function debounce(func, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  const searchForm = document.querySelector("search form");
  const searchInput = document.querySelector("#search");
  const searchResults = document.querySelector("output");
  let pagefindPromise;
  let latestSearchId = 0;

  function renderStatus(message) {
    searchResults.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = message;
    p.dataset.statusMessage = message;
    searchResults.appendChild(p);
  }

  async function getPagefind() {
    if (!pagefindPromise) {
      pagefindPromise = import("/web-features-explorer/pagefind/pagefind.js").then((pagefind) => {
        pagefind.init();
        return pagefind;
      });
    }

    return pagefindPromise;
  }

  const runSearch = debounce(async (query, searchId) => {
    if (query.length < MINIMUM_QUERY_LENGTH) {
      if (searchId === latestSearchId) {
        renderStatus(START_TYPING_MESSAGE);
      }
      return;
    }

    try {
      const pagefind = await getPagefind();
      const search = await pagefind.search(query);

      if (searchId !== latestSearchId) {
        return;
      }

      if (search.results.length === 0) {
        renderStatus(NO_RESULTS_MESSAGE);
        return;
      }

      const ul = document.createElement("ul");

      let counter = 0;
      for (const result of search.results) {
        counter ++;
        if (counter > MAX_RESULTS) {
          break;
        }

        const resultData = await result.data();

        if (searchId !== latestSearchId) {
          return;
        }

        const li = document.createElement("li");

        const a = document.createElement("a");
        a.href = resultData.url;

        const h3 = document.createElement("h3");
        h3.textContent = resultData.meta.title;

        const p = document.createElement("p");
        p.innerHTML = resultData.excerpt;

        a.appendChild(h3);
        a.appendChild(p);
        li.appendChild(a);
        ul.appendChild(li);
      }

      searchResults.innerHTML = "";
      searchResults.appendChild(ul);
    } catch {
      if (searchId === latestSearchId) {
        renderStatus(UNAVAILABLE_MESSAGE);
      }
    }
  }, 500);

  // Submit doesn't do anything, so don't clear the input
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  searchInput.addEventListener("focus", () => {
    if (!searchInput.value.trim()) {
      renderStatus(START_TYPING_MESSAGE);
    }

    getPagefind().catch(() => {
      renderStatus(UNAVAILABLE_MESSAGE);
    });
  });

  searchInput.addEventListener("blur", () => {
    const statusMessage = searchResults.querySelector("p[data-status-message]");
    if (statusMessage?.dataset.statusMessage === START_TYPING_MESSAGE) {
      searchResults.innerHTML = "";
    }
  });

  searchInput.addEventListener("input", (event) => {
    const query = event.target.value.trim();
    latestSearchId += 1;
    const searchId = latestSearchId;

    if (!query) {
      renderStatus(START_TYPING_MESSAGE);
      return;
    }

    if (query.length >= MINIMUM_QUERY_LENGTH) {
      renderStatus(SEARCHING_MESSAGE);
    }

    runSearch(query, searchId);
  });
});
