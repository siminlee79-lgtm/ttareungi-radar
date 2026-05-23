export async function onRequestGet(context) {
  const seoulOpenApiKey = context.env.SEOUL_OPEN_API_KEY;

  if (!seoulOpenApiKey) {
    return Response.json(
      {
        error: "Missing SEOUL_OPEN_API_KEY",
      },
      { status: 500 },
    );
  }

  const seoulBikeApi = `http://openapi.seoul.go.kr:8088/${seoulOpenApiKey}/json/bikeList`;

  try {
    const ranges = [
      [1, 1000],
      [1001, 2000],
      [2001, 3000],
    ];

    const responses = await Promise.all(
      ranges.map(async ([start, end]) => {
        const response = await fetch(`${seoulBikeApi}/${start}/${end}/`);

        if (!response.ok) {
          throw new Error(`Seoul API error: ${response.status}`);
        }

        return response.json();
      }),
    );

    const rows = responses.flatMap((data) => data.rentBikeStatus?.row || []);

    return Response.json(
      { rows },
      {
        headers: {
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
      { status: 502 },
    );
  }
}
