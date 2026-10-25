const http = require('node:http')
// Failure-only stand-in for the three public HTML pages used by the adapter.
http
  .createServer((_request, response) => {
    response.writeHead(503, { 'Content-Type': 'text/html' })
    response.end('<html><body>Source temporarily unavailable</body></html>')
  })
  .listen(Number(process.env.PORT || 4500))
