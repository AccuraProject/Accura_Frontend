# AccuraFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To produce an optimized build without running the unit tests automatically, use:

```bash
npm run build
```

This command simply proxies to `npm run build:prod`, which calls `ng build --configuration production` so the Angular compiler focuses solely on bundling the app.

If you need a development-optimized bundle you can run:

```bash
npm run build:dev
```

The build artifacts for both commands are emitted to the `dist/` directory.

## Running unit tests

Tests are now completely decoupled from the build pipeline. Execute them only when needed with:

```bash
npm run test:ci
```

This will run the Karma suite once in headless mode. For the traditional watch experience during development, run:

```bash
npm run test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
