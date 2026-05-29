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
  const pageSize = 1000;
  const firstPage = await fetchBikePage(baseUrl, 1, pageSize);
  const firstRows = firstPage.rentBikeStatus?.row || [];
  const totalCount = Number(firstPage.rentBikeStatus?.list_total_count) || firstRows.length;

  if (totalCount <= pageSize) {
    return firstRows;
  }

  const ranges = [];
  for (let start = pageSize + 1; start <= totalCount; start += pageSize) {
    ranges.push([start, Math.min(start + pageSize - 1, totalCount)]);
  }

  const restPages = await Promise.all(ranges.map(([start, end]) => fetchBikePage(baseUrl, start, end)));
  return firstRows.concat(restPages.flatMap((data) => data.rentBikeStatus?.row || []));
}
