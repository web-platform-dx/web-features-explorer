addEventListener("DOMContentLoaded", () => {
  function debounce(func, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  const searchInput = document.querySelector("#search");
  const searchResults = document.querySelector("output");

  searchInput.addEventListener(
    "focus",
    () => {
      // Use dynamic import to load /pagefind/pagefind.js
      import("/web-features-explorer/pagefind/pagefind.js").then((pagefind) => {
        pagefind.init();

        searchInput.addEventListener("input", debounce(async (event) => {
          searchResults.innerHTML = "";

          if (event.target.value.length < 2) {
            return;
          }

          const search = await pagefind.search(event.target.value);

          if (search.results.length === 0) {
            return;
          }

          const ul = document.createElement("ul");

          let counter = 0;
          for (const result of search.results) {
            counter ++;
            if (counter > 10) {
              break;
            }

            const resultData = await result.data();

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

          searchResults.appendChild(ul);
        }, 500));
      });
    },
    { once: true }
  );
});
