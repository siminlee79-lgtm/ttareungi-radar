const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, {
    headers: corsHeaders,
  });
}

export async function onRequestGet(context) {
  const seoulOpenApiKey = context.env.SEOUL_OPEN_API_KEY;

  if (!seoulOpenApiKey) {
    return Response.json(
      {
        error: "Missing SEOUL_OPEN_API_KEY",
      },
      { status: 500, headers: corsHeaders },
    );
  }

  const seoulBikeApi = `http://openapi.seoul.go.kr:8088/${seoulOpenApiKey}/json/bikeList`;

  try {
    const rows = await fetchAllBikeRows(seoulBikeApi);

    return Response.json(
      { rows },
      {
        headers: {
          ...corsHeaders,
          "Cache-Control": "public, max-age=30",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "Failed to load Seoul bike data",
        message: error.message,
      },
      { status: 502, headers: corsHeaders },
    );
  }
}

async function fetchBikePage(baseUrl, start, end) {
  const response = await fetch(`${baseUrl}/${start}/${end}/`);

  if (!response.ok) {
    throw new Error(`Seoul API error: ${response.status}`);
  }

  return response.json();
}

async function fetchAllBikeRows(baseUrl) {
  // The Seoul bikeList endpoint reports list_total_count as the size of the
  // requested page (1000), not the grand total, so we cannot trust it for
  // pagination. Instead we page sequentially until a page comes back short
  // (the last page) with a hard safety cap.
  const pageSize = 1000;
  const maxPages = 6;
  const allRows = [];

  for (let page = 0; page < maxPages; page += 1) {
    const start = page * pageSize + 1;
    const end = start + pageSize - 1;
    const data = await fetchBikePage(baseUrl, start, end);
    const rows = data.rentBikeStatus?.row || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return allRows;
}
