# web-features explorer

A website to visualize the data that's maintained in the [web-platform-dx/web-features](https://github.com/web-platform-dx/web-features/) repository.

Open the website: https://web-platform-dx.github.io/web-features-explorer/

## Goal

* To visualize the web-features data.
* To provide a way to explore the data in a more user-friendly way.
* To test various use cases that consumers of this data have.
* To detect issues in the data.

## Architecture

### Data

The data that the website is based on comes from the [web-features](https://www.npmjs.com/package/web-features) npm package, by using its **next** version (which always provide the data from the latest commit on the web-features repo).

In addition, the [@mdn/browser-compat-data](https://www.npmjs.com/package/browser-compat-data) npm package is used to get various other pieces of information, such as links to MDN documentation and links to bug trackers.

To ensure you have the latest data:

1. Run `npx npm-check-updates -u`

1. Run `npm update web-features`

### Build

The website consists of static HTML pages and uses a build script to generate those HTML pages from the data.

The template files, from which the static HTML pages get generated, use the [11ty](https://www.11ty.dev/) static website generator. The template files are found in the `site` directory.

The result of the build script is found in the `docs` directory, which is the directory that GitHub Pages uses to serve the website (see [Deployement](#deployment)).

To re-generate the website, after updating the data:

1. Run `npm install`

1. Run `npm run build` to generate the site
   
   You can also run `npm run serve` to start a local server and watch for changes

### Deployment

The website is deployed to production using [GitHub Pages](https://pages.github.com/).

The static HTML pages are generated into the `docs` directory, which is the directory that GitHub Pages uses by default to serve the website.

### Automatic updates

The website is automatically updated every day by using a GitHub Actions script found in `.github/workflows/generate-site.yaml`. This action updates the dependencies, runs the build script, and pushes the changes to the `main` branch, which then triggers the deployment to GitHub Pages.
