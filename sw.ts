import "https://raw.githubusercontent.com/ericselin/worker-types/main/cloudflare-worker-types.ts";

type RefererConfig = {
  [referer: string]: { repo: string; workflow: string };
};

declare const GITHUB_TOKEN: string;
declare const SETTINGS: KVNamespace;

const requestHeaders = {
  "Content-Type": "application/json",
  Authorization: `token ${GITHUB_TOKEN}`,
  // this is required by github
  "User-Agent": "Cloudflare Worker",
};

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
};

const handleRequest = async (event: FetchEvent): Promise<Response> => {
  let workflowByReferrer: RefererConfig | null;
  try {
    workflowByReferrer = await SETTINGS.get(
      "github-dispatch",
      "json",
    );
  } catch (e) {
    console.error(e);
    return new Response("Error getting config (invalid JSON?)", {
      headers: responseHeaders,
      status: 500,
    });
  }
  if (!workflowByReferrer) {
    return new Response("No referer config", {
      headers: responseHeaders,
      status: 500,
    });
  }
  if (!GITHUB_TOKEN) {
    return new Response("No GitHub token", {
      headers: responseHeaders,
      status: 500,
    });
  }
  const referer = event.request.headers.get("Referer");
  if (!referer) {
    return new Response("No referer", {
      headers: responseHeaders,
      status: 401,
    });
  }
  const refererUrl = new URL(referer);
  const workflow = workflowByReferrer[refererUrl.hostname];
  if (!workflow) {
    return new Response("Wrong referer", {
      headers: responseHeaders,
      status: 401,
    });
  }

  if (event.request.method === "POST") {
    const response = await fetch(
      `https://api.github.com/repos/reima-ecom/${workflow.repo}/dispatches`,
      {
        method: "POST",
        body: JSON.stringify({
          event_type: workflow.workflow,
        }),
        headers: requestHeaders,
      },
    );
    if (response.ok) return new Response("ok", { headers: responseHeaders });
    return new Response(response.statusText, {
      headers: responseHeaders,
      status: response.status,
    });
  }
  if (event.request.method === "GET") {
    const response = await fetch(
      `https://api.github.com/repos/reima-ecom/${workflow.repo}/actions/workflows/${workflow.workflow}.yml/runs`,
      { method: "GET", headers: requestHeaders },
    );
    if (response.ok) {
      const details = await response.json();
      const runs = details.workflow_runs;
      if (!runs || !runs.length) {
        return new Response("No workflow runs found", {
          headers: responseHeaders,
          status: 404,
        });
      }
      const { status, conclusion, created_at: createdAt } = runs[0];
      return new Response(
        JSON.stringify({ status, conclusion, createdAt }),
        { headers: { ...responseHeaders, "content-type": "application/json" } },
      );
    }
    return new Response(response.statusText, {
      headers: responseHeaders,
      status: response.status,
    });
  }
  return new Response("Unsupported method", {
    headers: responseHeaders,
    status: 405,
  });
};

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
