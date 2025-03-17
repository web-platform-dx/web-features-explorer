# Web platform features explorer

The web platform features explorer website visualizes the web platform data that's maintained in the [web-platform-dx/web-features](https://github.com/web-platform-dx/web-features/) repository.

View the live website at https://web-platform-dx.github.io/web-features-explorer/.

## Goals of the website

* To test and visualize the data that's in the web-features repo.
* To connect the data to other relevant sources of information about web features.
* To provide web developers with useful ways to stay up to date with the web and explore features.

## Architecture

### Data

The data that the website is based on comes from the [web-features](https://www.npmjs.com/package/web-features) NPM package. The site uses the **next** version if the package, which provide the data from the latest commit on the web-features repo.

In addition, the site uses the [@mdn/browser-compat-data](https://www.npmjs.com/package/browser-compat-data) NPM package to get various other pieces of information, such as links to MDN documentation and links to bug trackers.

### Pages

The web pages are built by using the [Eleventy static site generator](https://www.11ty.dev/).

## Local development

To run the website locally, clone the repository, make sure the dependencies are updated, and then build the site.

### Update the dependencies

To ensure you have the latest data:

1. Run `npx npm-check-updates -u`

1. Run `npm update web-features`

1. `npm install`

### Build the site

To build the site:

1. Run `npm run build` to generate the site

1. Check the `docs` folder for the resulting build files.

The source template files used to build the site are in the `site` folder.

### Run and edit the site locally

To run the website on a local development server:

1. Run `npm run serve`.

1. Open a web browser and go to `http://localhost:8080`.

1. Modify a source file, wait for the build to run automatically, and for the changes to appear in the browser.

The result of the build script is found in the `docs` directory, which is the directory that GitHub Pages uses to serve the website (see [Deployment](#deployment)).

## Production environment

The website is deployed to production using [GitHub Pages](https://pages.github.com/). The static HTML pages are generated in the [gh-pages branch](https://github.com/web-platform-dx/web-features-explorer/tree/gh-pages) on a regular basis by the GitHub Actions script found in `.github/workflows/generate-site.yaml`.

The dependencies are also automatically updated every day by using the GitHub Actions script in `.github/workflows/bump-deps.yaml`.
