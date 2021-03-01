# GitHub Dispatch Worker

Sends "repository dispatch" events to GitHub based on the HTTP referer. Can be used to create e.g. import workflows that can be initiated via the browser.

## Configuration

Set the appropriate config in `WORKFLOW_BY_REFERER` in `sw.ts` for each site / referer.

Please also set the `GITHUB_TOKEN` secret on the worker. Should be a GitHub access token with scopes required to dispatch the event.