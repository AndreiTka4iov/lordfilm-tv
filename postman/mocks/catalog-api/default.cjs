const http = require('node:http')
// Contract-shaped test data only. The new shelf deliberately returns the documented 502.
http
  .createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Cache-Control', 'no-store')
    if (request.url.startsWith('/v1/catalog/search')) {
      const query =
        new URL(request.url, 'http://mock').searchParams.get('q')?.trim() ?? ''
      if (query.length < 2 || query.length > 200) {
        response.writeHead(400).end(
          JSON.stringify({
            error: { code: 'INVALID_QUERY', message: 'Invalid query' },
          }),
        )
        return
      }
      response.end(
        JSON.stringify({
          query,
          limited: false,
          items: Array.from({ length: 20 }, (_, i) => ({
            id: String(i + 1),
            slug: `contract-movie-${i + 1}`,
            title: `${query} ${i + 1}`,
            poster: null,
            year: 2026,
            rating: 8,
            kind: 'movie',
            sourceUrl: `https://example.com/movie/${i + 1}`,
          })),
        }),
      )
      return
    }
    const playback =
      /^\/v1\/movies\/(\d+)\/([a-zA-Z0-9_-]+)\/playback(?:\?.*)?$/.exec(
        request.url,
      )
    if (playback && request.method === 'GET') {
      const query = new URL(request.url, 'http://mock').searchParams
      for (const key of ['season', 'episode']) {
        const values = query.getAll(key)
        if (
          values.length > 1 ||
          (values.length && !/^[1-9]\d{0,3}$/.test(values[0]))
        ) {
          response.writeHead(400).end(
            JSON.stringify({
              error: {
                code: 'INVALID_SELECTION',
                message: 'Invalid selection',
              },
            }),
          )
          return
        }
      }
      response.end(
        JSON.stringify({
          kind: 'movie',
          type: 'hls',
          cdnTime: null,
          src: 'https://fixture.interkh.com/master.m3u8',
          audioNames: [],
          seasons: [],
          episodes: [],
          season: null,
          episode: null,
        }),
      )
      return
    }
    const movie = /^\/v1\/movies\/(\d+)\/([a-zA-Z0-9_-]+)$/.exec(request.url)
    if (movie && request.method === 'GET') {
      response.end(
        JSON.stringify({
          id: movie[1],
          slug: movie[2],
          title: 'Contract movie detail',
          backdrop: null,
          year: 2026,
          kind: 'movie',
          poster: null,
          rating: 8.2,
          sourceUrl: 'https://example.com/movie/1',
          description: 'Contract description',
          originalTitle: null,
          duration: null,
          genres: ['Drama'],
          countries: [],
          directors: [],
          actors: [],
        }),
      )
      return
    }
    const group = /^\/v1\/catalog\/pools\/(popular|new|series)$/.exec(
      request.url,
    )?.[1]
    if (request.method !== 'GET' || !group) {
      response.writeHead(501).end(
        JSON.stringify({
          error: { code: 'NOT_SIMULATED', message: 'Not simulated' },
        }),
      )
      return
    }
    if (group === 'new') {
      response.writeHead(502).end(
        JSON.stringify({
          error: {
            code: 'UPSTREAM_UNAVAILABLE',
            message: 'Catalog source unavailable',
          },
        }),
      )
      return
    }
    response.end(
      JSON.stringify({
        group,
        generatedAt: '2026-10-25T12:00:00.000Z',
        items: Array.from({ length: 20 }, (_, index) => ({
          id: String(index + 1),
          slug: `contract-movie-${index + 1}`,
          title: `Contract movie ${index + 1}`,
          year: 2026,
          poster: null,
          rating: null,
          kind: group === 'series' ? 'series' : 'movie',
          sourceUrl: `https://example.com/movie/${index + 1}`,
        })),
      }),
    )
  })
  .listen(Number(process.env.PORT || 4500))
